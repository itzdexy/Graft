import { describe, expect, test } from 'bun:test'
import { describeTovyrContextWindow } from './modelContext.js'
import { formatProviderConnectionSnapshot } from './providers/probe.js'

/**
 * A wrong context window is silent: it renders as a plausible percentage and
 * nothing says where the number came from. stealth/ox-alpha ran at the 32k
 * default against a real 1,048,576 with no way to tell from inside the app.
 * Provenance makes that visible.
 */
describe('context window provenance', () => {
  test('falls back to the default for an unrecognised model', () => {
    const result = describeTovyrContextWindow('totally/unknown-model-xyz')
    expect(result.source).toBe('default')
    expect(result.tokens).toBe(32_768)
  })

  test('infers from a recognisable model id', () => {
    const result = describeTovyrContextWindow('google/gemini-2.0-pro')
    expect(result.source).toBe('inferred')
    expect(result.tokens).toBe(1_000_000)
  })

  test('always returns a positive token count', () => {
    for (const id of ['a', 'x/y', 'stealth/ox-alpha', '']) {
      expect(describeTovyrContextWindow(id).tokens).toBeGreaterThan(0)
    }
  })
})

describe('doctor surfaces context sizing', () => {
  const snapshot = {
    providerLabel: 'OpenRouter',
    modelId: 'totally/unknown-model-xyz',
    state: 'ready',
    modelState: 'verified',
    latencyMs: 412,
    supportsStreaming: true,
  }

  test('reports the window, its source, and the max output', () => {
    const out = formatProviderConnectionSnapshot(snapshot as never)
    expect(out).toContain('Context window:')
    expect(out).toContain('32,768')
    expect(out).toContain('Max output:')
  })

  test('says plainly when the model list has not been fetched', () => {
    const out = formatProviderConnectionSnapshot(snapshot as never)
    expect(out).toContain('Model list:')
    // The actionable half: a default window means the list never loaded.
    expect(out).toMatch(/model unknown|not fetched/)
  })

  test('still reports provider and model state', () => {
    const out = formatProviderConnectionSnapshot(snapshot as never)
    expect(out).toContain('OpenRouter')
    expect(out).toContain('Provider: reachable')
    expect(out).toContain('Model: verified')
  })
})
