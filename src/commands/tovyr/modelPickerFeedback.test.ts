import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), 'src', relativePath), 'utf8')
}

/**
 * Enter used to call activateProviderModel directly and await a probe that can
 * run for seconds with nothing on screen, so the picker looked dead. These
 * guard the feedback path that replaced it.
 */
describe('model picker activation feedback', () => {
  const picker = source('commands/tovyr/models.tsx')

  test('routes Enter through the shared activation flow', () => {
    expect(picker).toContain('runModelActivationAttempt')
    expect(picker).toContain("from './modelActivationFlow.js'")
  })

  test('paints a checking row while the probe is in flight', () => {
    expect(picker).toContain('onChecking')
    expect(picker).toContain('<CheckingRow')
    expect(picker).toContain('isDisabled={checking !== null}')
  })

  test('keeps a rejected model inline instead of closing the picker', () => {
    const onFailure = picker.indexOf('onFailure:')
    const onSuccess = picker.indexOf('onSuccess:')

    expect(onFailure).toBeGreaterThan(0)
    expect(picker.slice(onFailure, onSuccess)).toContain('setActivationError')
    // Only a successful switch should hand control back to the chat.
    expect(picker.slice(onFailure, onSuccess)).not.toContain('onDone(')
    expect(picker.slice(onSuccess)).toContain('onDone(')
  })
})

/**
 * A model that only timed out is usable — the provider answered, it was just
 * slow. NVIDIA's large MoE reasoning models routinely exceed the probe budget
 * on a cold first token, and before this they could never be selected.
 */
describe('slow model override', () => {
  const picker = source('commands/tovyr/models.tsx')

  test('offers to accept a model that merely timed out', () => {
    expect(picker).toContain("result.readiness === 'slow'")
    expect(picker).toContain('Press Enter again to use it anyway.')
  })

  test('a second Enter on that model passes allowSlow through', () => {
    expect(picker).toContain('slowCandidate')
    expect(picker).toContain('activateProviderModel({ ...candidate, allowSlow, setAppState })')
  })

  test('does not offer the override for a genuinely unusable model', () => {
    const onFailure = picker.indexOf('onFailure:')
    const block = picker.slice(onFailure, picker.indexOf('onSuccess:'))
    expect(block).toContain('setSlowCandidate(retryable ? { providerId, modelId } : null)')
  })
})
