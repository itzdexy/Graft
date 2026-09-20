import {
  classifyProbeOutcome,
  extractOpenAiAssistantText,
  extractOpenAiDeltaText,
  extractProbePayloadText,
  formatProviderConnectionSnapshot,
  providerReachableFromProbeEvidence,
  readProviderQuota,
  stateForError,
  stateForProbeResult,
} from './probe.js'

describe('provider connection probe helpers', () => {
  test('reads provider-neutral request quota headers', () => {
    const quota = readProviderQuota(
      new Headers({
        'x-ratelimit-remaining-requests': '0',
        'x-ratelimit-limit-requests': '100',
        'x-ratelimit-reset-requests': '2000000000',
      }),
    )

    expect(quota).toEqual({
      limited: true,
      remaining: 0,
      limit: 100,
      resetsAt: 2_000_000_000,
    })
  })

  test('returns undefined without quota evidence', () => {
    expect(readProviderQuota(new Headers())).toBeUndefined()
  })

  test('treats a real non-streamed probe answer as ready', () => {
    expect(stateForProbeResult({ text: 'OK' })).toBe('ready')
  })

  test('reports degraded only when the provider returns no model output', () => {
    expect(stateForProbeResult({ text: '   ' })).toBe('degraded')
  })

  test('quota state takes priority over model output', () => {
    expect(
      stateForProbeResult({
        text: 'OK',
        quota: { limited: true },
      }),
    ).toBe('limited')
  })

  test('distinguishes a slow model from an offline provider', () => {
    // Reachable + timeout means the API is up; don't paint the session degraded.
    expect(stateForError('timeout')).toBe('offline')
    expect(stateForError('timeout', true)).toBe('ready')
  })

  test('does not call a reachable provider model ready after inference times out', () => {
    expect(
      classifyProbeOutcome({ providerReachable: true, timedOut: true }),
    ).toEqual({
      providerState: 'reachable',
      modelState: 'slow',
      hardFailure: false,
    })
  })

  test('uses warm inventory as reachability evidence without another network request', () => {
    expect(
      providerReachableFromProbeEvidence({
        errorKind: 'timeout',
        hasWarmInventory: true,
      }),
    ).toBe(true)
    expect(
      providerReachableFromProbeEvidence({
        errorKind: 'timeout',
        hasWarmInventory: false,
      }),
    ).toBe(false)
  })

  test('uses an HTTP response as reachability evidence', () => {
    expect(
      providerReachableFromProbeEvidence({
        errorKind: 'unknown',
        hasWarmInventory: false,
        status: 404,
      }),
    ).toBe(true)
  })

  test('classifies a missing chat model as a hard model failure', () => {
    expect(
      classifyProbeOutcome({ providerReachable: true, status: 404 }),
    ).toEqual({
      providerState: 'reachable',
      modelState: 'unavailable',
      hardFailure: true,
    })
  })

  test('formats provider and model health as separate evidence', () => {
    expect(
      formatProviderConnectionSnapshot({
        state: 'ready',
        providerId: 'nvidia_nim',
        providerLabel: 'NVIDIA NIM',
        modelId: 'meta/llama',
        modelState: 'slow',
      }),
    ).toContain('Provider: reachable\nModel: slow')
  })

  test('treats reasoning_content as live model output for GLM-style probes', () => {
    expect(
      extractOpenAiDeltaText({ reasoning_content: 'thinking…' }),
    ).toBe('thinking…')
    expect(
      extractOpenAiAssistantText({
        content: null as unknown as string,
        reasoning_content: 'plan',
      }),
    ).toBe('plan')
  })

  test('treats Anthropic thinking blocks as live Muse Spark output', () => {
    expect(
      extractProbePayloadText({
        content: [{ type: 'thinking', thinking: 'internal plan' }],
      }),
    ).toBe('internal plan')
    expect(
      extractProbePayloadText({
        content: [{ type: 'text', text: '' }],
      }),
    ).toBe('')
  })
})
