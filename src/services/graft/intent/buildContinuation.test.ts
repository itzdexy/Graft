import { describe, expect, test } from 'bun:test'
import { isBuildContinuation, isImplementationRequest } from './buildIntent.js'
import { resolveImplementationPrompt } from './implementationGuard.js'
import type { Message } from '../../../types/message.js'

function user(text: string): Message {
  return {
    type: 'user',
    message: { role: 'user', content: text },
  } as unknown as Message
}

function assistant(text: string): Message {
  return {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  } as unknown as Message
}

/**
 * The guard engaged on "build me a website" and then went silent for the rest
 * of the session, because each follow-up was judged on its own words.
 */
describe('build continuations keep the implementation guard engaged', () => {
  test('recognises the follow-ups a user actually types', () => {
    for (const text of ['do it', 'build it now', 'go ahead', 'continue', 'yes', 'r', 'try again']) {
      expect(isBuildContinuation(text)).toBe(true)
      // Each of these is exactly what the old gate rejected.
      expect(isImplementationRequest(text)).toBe(false)
    }
  })

  test('does not treat a new unrelated request as a continuation', () => {
    expect(isBuildContinuation('what time is it')).toBe(false)
    expect(isBuildContinuation('explain this function')).toBe(false)
    expect(isBuildContinuation('/model')).toBe(false)
  })

  test('a bare "do it" inherits the earlier build request', () => {
    const messages = [
      user('build me a website'),
      assistant('Here is a plan.'),
      user('do it'),
    ]
    expect(resolveImplementationPrompt(messages)).toBe('build me a website')
  })

  test('inherits across several turns of flailing', () => {
    const messages = [
      user('build me a website'),
      assistant('Step 1: Planning'),
      user('build it now'),
      assistant('Task Status: Failed'),
      user('do it'),
    ]
    expect(resolveImplementationPrompt(messages)).toBe('build me a website')
  })

  test('a continuation with no prior build request stays inert', () => {
    const messages = [user('what time is it'), assistant('12:49'), user('do it')]
    expect(resolveImplementationPrompt(messages)).toBeNull()
  })

  test('a direct build request still resolves to itself', () => {
    expect(resolveImplementationPrompt([user('make me a dashboard')])).toBe(
      'make me a dashboard',
    )
  })
})
