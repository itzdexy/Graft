import { describe, expect, test } from 'bun:test'
import {
  buildModelRows,
  countProviders,
  modelRowGroup,
  presentModelRow,
  TIER_LABEL,
  type BuildModelRowsInput,
} from './modelRows.js'

const SOURCES: BuildModelRowsInput['sources'] = [
  {
    providerId: 'anthropic',
    providerLabel: 'Anthropic',
    connected: true,
    activeModelId: 'claude-sonnet-5',
    verifiedIds: new Set(['claude-sonnet-5', 'claude-opus-4-5']),
    models: [
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', tier: 'haiku' },
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', tier: 'opus' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', tier: 'sonnet' },
    ],
  },
  {
    providerId: 'openai',
    providerLabel: 'OpenAI',
    connected: true,
    models: [
      { id: 'gpt-5', label: 'GPT-5', tier: 'opus' },
      { id: 'gpt-5-mini', label: 'GPT-5 mini', tier: 'haiku' },
    ],
  },
  {
    providerId: 'groq',
    providerLabel: 'Groq',
    connected: false,
    models: [{ id: 'llama-3.3-70b', label: 'Llama 3.3 70B', tier: 'opus' }],
  },
]

function build(
  overrides: Partial<BuildModelRowsInput> = {},
): ReturnType<typeof buildModelRows> {
  return buildModelRows({
    sources: SOURCES,
    activeProviderId: 'anthropic',
    ...overrides,
  })
}

describe('buildModelRows', () => {
  test('the active model is the very first row', () => {
    expect(build()[0]!.modelId).toBe('claude-sonnet-5')
  })

  test('models from every connected provider appear in one list', () => {
    const providers = new Set(build().map(r => r.providerId))
    expect(providers).toEqual(new Set(['anthropic', 'openai']))
  })

  test('disconnected providers are excluded by default', () => {
    expect(build().map(r => r.providerId)).not.toContain('groq')
  })

  test('disconnected providers can be opted in', () => {
    expect(
      build({ includeDisconnected: true }).map(r => r.providerId),
    ).toContain('groq')
  })

  test('the active provider sorts ahead of the others', () => {
    const rows = build()
    const firstOpenAi = rows.findIndex(r => r.providerId === 'openai')
    const lastAnthropic = rows.map(r => r.providerId).lastIndexOf('anthropic')
    expect(lastAnthropic).toBeLessThan(firstOpenAi)
  })

  test('verified models sort ahead of catalog-only ones', () => {
    const anthropic = build().filter(r => r.providerId === 'anthropic')
    // active first, then the other verified id, then the unverified haiku.
    expect(anthropic.map(r => r.modelId)).toEqual([
      'claude-sonnet-5',
      'claude-opus-4-5',
      'claude-haiku-4-5',
    ])
  })

  test('within one verification bucket the best tier leads', () => {
    const openai = build().filter(r => r.providerId === 'openai')
    expect(openai.map(r => r.modelId)).toEqual(['gpt-5', 'gpt-5-mini'])
  })

  test('unavailable ids are dropped', () => {
    const rows = buildModelRows({
      activeProviderId: 'anthropic',
      sources: [
        {
          ...SOURCES[0]!,
          unavailableIds: new Set(['claude-haiku-4-5']),
        },
      ],
    })
    expect(rows.map(r => r.modelId)).not.toContain('claude-haiku-4-5')
  })

  test('every row carries a human tier label', () => {
    const opus = build().find(r => r.modelId === 'claude-opus-4-5')!
    expect(opus.tierLabel).toBe(TIER_LABEL.opus)
  })

  test('no connected providers yields an empty list, not a crash', () => {
    expect(
      buildModelRows({
        sources: [{ ...SOURCES[2]! }],
        activeProviderId: 'groq',
      }),
    ).toEqual([])
  })
})

describe('presentModelRow', () => {
  test('detail leads with the qualified id users have to paste', () => {
    const row = build()[0]!
    expect(presentModelRow(row).detail).toBe(
      'anthropic/claude-sonnet-5 · Balanced',
    )
  })

  test('active outranks verified for the badge', () => {
    const row = build()[0]!
    expect(presentModelRow(row).badge).toBe('active')
  })

  test('a verified non-active model says so', () => {
    const row = build().find(r => r.modelId === 'claude-opus-4-5')!
    expect(presentModelRow(row).badge).toBe('listed')
  })

  test('a catalog-only model gets no badge', () => {
    const row = build().find(r => r.modelId === 'gpt-5')!
    expect(presentModelRow(row).badge).toBe('')
  })
})

describe('modelRowGroup', () => {
  test('groups by provider with no query', () => {
    expect(modelRowGroup(build()[0]!, '')).toBe('Anthropic')
  })

  test('search results are not regrouped', () => {
    expect(modelRowGroup(build()[0]!, 'opus')).toBeUndefined()
  })
})

describe('countProviders', () => {
  test('counts distinct providers', () => {
    expect(countProviders(build())).toBe(2)
  })

  test('empty list counts zero', () => {
    expect(countProviders([])).toBe(0)
  })
})

describe('live metadata tags', () => {
  const withDescriptors: BuildModelRowsInput['sources'] = [
    {
      providerId: 'openrouter',
      providerLabel: 'OpenRouter',
      connected: true,
      anyModel: true,
      models: [
        { id: 'stealth/ox-alpha', label: 'Ox Alpha', tier: 'opus' },
        { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', tier: 'sonnet' },
      ],
      descriptors: [
        {
          id: 'stealth/ox-alpha',
          displayName: 'Ox Alpha',
          available: true,
          contextTokens: 1_000_000,
          maxOutputTokens: null,
          supportsTools: true,
          supportsVision: true,
          supportsReasoning: null,
          supportsStreaming: null,
          lifecycle: 'unknown',
          source: 'provider',
          pricing: { promptPerM: 0, completionPerM: 0 },
          tags: ['FREE', 'TOOLS', '1M ctx', 'IMAGE'],
        },
      ],
    },
  ]

  test('a model carries the tags its provider reported', () => {
    const rows = buildModelRows({
      sources: withDescriptors,
      activeProviderId: 'openrouter',
    })
    const ox = rows.find(r => r.modelId === 'stealth/ox-alpha')!
    expect(ox.tags).toEqual(['FREE', 'TOOLS', '1M ctx', 'IMAGE'])
  })

  test('a model with no descriptor gets no invented tags', () => {
    const rows = buildModelRows({
      sources: withDescriptors,
      activeProviderId: 'openrouter',
    })
    const sonnet = rows.find(r => r.modelId === 'anthropic/claude-sonnet-5')!
    expect(sonnet.tags).toEqual([])
  })

  test('free models are badged, and the id + tags land in the detail line', () => {
    const rows = buildModelRows({
      sources: withDescriptors,
      activeProviderId: 'openrouter',
    })
    const ox = rows.find(r => r.modelId === 'stealth/ox-alpha')!
    const shown = presentModelRow(ox)
    expect(shown.badge).toBe('free')
    expect(shown.detail).toBe(
      'openrouter/stealth/ox-alpha · FREE · TOOLS · 1M ctx · IMAGE · Best',
    )
  })

  test('local providers tag rows LOCAL instead of pricing them', () => {
    const rows = buildModelRows({
      activeProviderId: 'ollama',
      sources: [
        {
          providerId: 'ollama',
          providerLabel: 'Ollama',
          connected: true,
          local: true,
          models: [{ id: 'qwen2.5-coder:1.5b', label: 'Qwen 2.5 Coder', tier: 'haiku' }],
        },
      ],
    })
    expect(rows[0]!.tags).toEqual(['LOCAL'])
  })
})
