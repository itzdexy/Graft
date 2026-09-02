import { describe, expect, test } from 'bun:test'
import {
  extractCreatedSessionId,
  extractSessionOutput,
  interpretSessionPoll,
  isSessionTerminalFailure,
  isSessionTerminalSuccess,
  tryImmediateCreateResult,
} from './sessionParsing.js'

describe('sessionParsing', () => {
  test('terminal success statuses', () => {
    for (const s of ['completed', 'Finished', 'DONE']) {
      expect(isSessionTerminalSuccess(s)).toBe(true)
    }
    expect(isSessionTerminalSuccess('running')).toBe(false)
  })

  test('terminal failure statuses', () => {
    expect(isSessionTerminalFailure('failed')).toBe(true)
    expect(isSessionTerminalFailure('error')).toBe(true)
    expect(isSessionTerminalFailure('pending')).toBe(false)
  })

  test('extractSessionOutput prefers output then result', () => {
    expect(extractSessionOutput({ output: 'hello' })).toBe('hello')
    expect(extractSessionOutput({ result: 'alt' })).toBe('alt')
    expect(extractSessionOutput({ status: 'x' })).toContain('status')
  })

  test('interpretSessionPoll outcomes', () => {
    expect(interpretSessionPoll({ status: 'completed', output: 'ok' })).toEqual({
      kind: 'success',
      output: 'ok',
    })
    expect(interpretSessionPoll({ status: 'failed', error: 'boom' })).toEqual({
      kind: 'failed',
      error: 'boom',
    })
    expect(interpretSessionPoll({ status: 'running' })).toEqual({ kind: 'pending' })
  })

  test('create response helpers', () => {
    expect(extractCreatedSessionId({ id: '  abc  ' })).toBe('abc')
    expect(extractCreatedSessionId({})).toBeUndefined()
    expect(tryImmediateCreateResult({ output: 'instant' })).toBe('instant')
    expect(tryImmediateCreateResult({ id: 's1', output: 'x' })).toBeUndefined()
  })
})