import { describe, expect, test } from 'bun:test'
import {
  buildProviderRows,
  CONNECTED_GROUP,
  isMediaCategory,
  presentProviderRow,
  providerRowGroup,
  shouldIncludeMediaProviders,
  type BuildProviderRowsInput,
} from './providerRows.js'

const CATEGORIES: BuildProviderRowsInput['categories'] = [
  {
    id: 'direct',
    label: 'Model APIs',
    providers: [
      { id: 'anthropic', label: 'Anthropic', keyHint: 'sk-ant-…' },
      { id: 'openai', label: 'OpenAI', keyHint: 'sk-…' },
    ].map(p => ({ ...p, category: 'direct' })),
  },
  {
    id: 'gateway',
    label: 'Multi-model routers',
    providers: [
      {
        id: 'openrouter',
        label: 'OpenRouter',
        category: 'gateway',
        keyHint: 'sk-or-…',
        anyModel: true,
      },
    ],
  },
  {
    id: 'self_hosted',
    label: 'Self-hosted',
    providers: [{ id: 'ollama', label: 'Ollama', category: 'self_hosted' }],
  },
  {
    id: 'media_image',
    label: 'Image APIs',
    providers: [
      { id: 'falai', label: 'fal.ai', category: 'media_image', keyHint: 'fal-…' },
    ],
  },
]

function build(
  overrides: Partial<BuildProviderRowsInput> = {},
): ReturnType<typeof buildProviderRows> {
  return buildProviderRows({
    categories: CATEGORIES,
    activeProviderId: 'anthropic',
    connectedIds: new Set(['anthropic', 'openai']),
    localIds: new Set(['ollama']),
    isOnline: true,
    ...overrides,
  })
}

describe('buildProviderRows', () => {
  test('lists connected providers first, active at the very top', () => {
    const ids = build().map(r => r.id)
    // Active pinned first, then the rest of the connected block A-Z by label
    // ("Ollama" before "OpenAI").
    expect(ids.slice(0, 3)).toEqual(['anthropic', 'ollama', 'openai'])
  })

  test('a local runtime counts as connected without a key', () => {
    const ollama = build().find(r => r.id === 'ollama')!
    expect(ollama.connected).toBe(true)
    expect(ollama.local).toBe(true)
  })

  test('the unconnected catalog follows the connected block', () => {
    const ids = build().map(r => r.id)
    expect(ids).toContain('openrouter')
    expect(ids.indexOf('openrouter')).toBeGreaterThan(ids.indexOf('openai'))
  })

  test('a provider is listed exactly once', () => {
    // Repeating connected providers inside their category made every search
    // return the same provider twice.
    const ids = build().map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('media providers are hidden by default', () => {
    expect(build().map(r => r.id)).not.toContain('falai')
  })

  test('media providers appear when explicitly included', () => {
    expect(build({ includeMedia: true }).map(r => r.id)).toContain('falai')
  })

  test('offline keeps only local providers', () => {
    const ids = build({ isOnline: false }).map(r => r.id)
    expect(new Set(ids)).toEqual(new Set(['ollama']))
  })

  test('an unconnected provider is marked as such', () => {
    const openrouter = build().find(r => r.id === 'openrouter')!
    expect(openrouter.connected).toBe(false)
    expect(openrouter.active).toBe(false)
  })

  test('nothing connected yields a pure catalog list', () => {
    const rows = build({
      connectedIds: new Set(),
      localIds: new Set(),
      activeProviderId: '',
    })
    expect(rows.every(r => !r.connected)).toBe(true)
    expect(rows[0]!.id).toBe('anthropic')
  })
})

describe('shouldIncludeMediaProviders', () => {
  test('hidden with no query', () => {
    expect(shouldIncludeMediaProviders('')).toBe(false)
    expect(shouldIncludeMediaProviders('   ')).toBe(false)
  })

  test('revealed once the user searches', () => {
    expect(shouldIncludeMediaProviders('fal')).toBe(true)
  })
})

describe('isMediaCategory', () => {
  test('detects the media prefixes', () => {
    expect(isMediaCategory('media_image')).toBe(true)
    expect(isMediaCategory('media_voice')).toBe(true)
    expect(isMediaCategory('gateway')).toBe(false)
  })
})

describe('presentProviderRow', () => {
  const base = {
    id: 'x',
    label: 'X',
    category: 'direct',
    categoryLabel: 'Model APIs',
    connected: false,
    local: false,
    active: false,
  }

  test('active wins over connected', () => {
    expect(presentProviderRow({ ...base, active: true, connected: true }).badge).toBe(
      'active',
    )
  })

  test('a local runtime reads as ready, not as a saved key', () => {
    expect(presentProviderRow({ ...base, local: true, connected: true }).badge).toBe(
      'ready',
    )
  })

  test('a connected remote provider shows its saved key', () => {
    expect(presentProviderRow({ ...base, connected: true }).badge).toBe(
      'key saved',
    )
  })

  test('an unconnected provider gets no badge', () => {
    expect(presentProviderRow(base).badge).toBe('')
  })

  test('detail shows the key hint and any-model capability', () => {
    const detail = presentProviderRow({
      ...base,
      keyHint: 'sk-or-…',
      anyModel: true,
    }).detail
    expect(detail).toBe('sk-or-… · any model id')
  })

  test('media rows say what they are', () => {
    expect(
      presentProviderRow({ ...base, category: 'media_image' }).detail,
    ).toContain('not a chat model')
  })
})

describe('providerRowGroup', () => {
  const row = {
    id: 'anthropic',
    label: 'Anthropic',
    category: 'direct',
    categoryLabel: 'Model APIs',
    connected: true,
    local: false,
    active: true,
  }

  test('the connected block gets its own heading', () => {
    expect(providerRowGroup(row, 0, 2, '')).toBe(CONNECTED_GROUP)
  })

  test('catalog rows are headed by their category', () => {
    expect(providerRowGroup(row, 5, 2, '')).toBe('Model APIs')
  })

  test('search results are not regrouped', () => {
    expect(providerRowGroup(row, 0, 2, 'claude')).toBeUndefined()
  })
})
