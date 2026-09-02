import { describe, expect, test } from 'bun:test'
import {
  isEntryFresh,
  MODEL_CACHE_TTL_MS,
  parseStore,
  pruneStore,
  type ProviderModelEntry,
  type ProviderModelStore,
} from './providerModelCache.js'

function entry(
  providerId: string,
  fetchedAt: number,
  ids: string[] = ['a'],
): ProviderModelEntry {
  return { providerId, ids, descriptors: [], fetchedAt }
}

const NOW = 1_700_000_000_000

describe('isEntryFresh', () => {
  test('a just-written entry is fresh', () => {
    expect(isEntryFresh(entry('openrouter', NOW), NOW)).toBe(true)
  })

  test('an entry inside the TTL is fresh', () => {
    expect(
      isEntryFresh(entry('openrouter', NOW - MODEL_CACHE_TTL_MS + 1000), NOW),
    ).toBe(true)
  })

  test('an entry past the TTL is stale', () => {
    expect(
      isEntryFresh(entry('openrouter', NOW - MODEL_CACHE_TTL_MS - 1), NOW),
    ).toBe(false)
  })

  test('a missing entry is never fresh', () => {
    expect(isEntryFresh(null, NOW)).toBe(false)
    expect(isEntryFresh(undefined, NOW)).toBe(false)
  })

  test('a future timestamp does not make an entry immortal', () => {
    // A clock jump backwards would otherwise pin the cache forever.
    expect(isEntryFresh(entry('openrouter', NOW + 60_000), NOW)).toBe(false)
  })
})

describe('per-provider isolation', () => {
  test('entries for different providers coexist', () => {
    const store: ProviderModelStore = {
      openrouter: entry('openrouter', NOW, ['a', 'b']),
      anthropic: entry('anthropic', NOW, ['c']),
    }
    const pruned = pruneStore(store, NOW)
    // Switching providers used to wipe the other provider's list entirely.
    expect(Object.keys(pruned).sort()).toEqual(['anthropic', 'openrouter'])
    expect(pruned.openrouter!.ids).toEqual(['a', 'b'])
    expect(pruned.anthropic!.ids).toEqual(['c'])
  })
})

describe('pruneStore', () => {
  test('keeps recent entries', () => {
    const store = { a: entry('a', NOW - 1000) }
    expect(Object.keys(pruneStore(store, NOW))).toEqual(['a'])
  })

  test('drops entries past the max age', () => {
    const store = { a: entry('a', NOW - 40 * 24 * 60 * 60 * 1000) }
    expect(pruneStore(store, NOW)).toEqual({})
  })

  test('drops malformed entries', () => {
    const store = {
      good: entry('good', NOW),
      bad: { providerId: 'bad' } as unknown as ProviderModelEntry,
    }
    expect(Object.keys(pruneStore(store, NOW))).toEqual(['good'])
  })
})

describe('parseStore', () => {
  test('round-trips a valid store', () => {
    const store = { openrouter: entry('openrouter', NOW, ['x']) }
    expect(parseStore(JSON.parse(JSON.stringify(store)))).toEqual(store)
  })

  test('a corrupt file yields an empty store, not a throw', () => {
    expect(parseStore(null)).toEqual({})
    expect(parseStore('nope')).toEqual({})
    expect(parseStore([1, 2, 3])).toEqual({})
  })

  test('entries missing ids or timestamps are skipped', () => {
    expect(parseStore({ a: { fetchedAt: NOW }, b: { ids: ['x'] } })).toEqual({})
  })

  test('non-string ids are filtered out', () => {
    const parsed = parseStore({
      a: { ids: ['ok', 42, null], fetchedAt: NOW },
    })
    expect(parsed.a!.ids).toEqual(['ok'])
  })
})

describe('reset semantics', () => {
  test('reset means empty, not "re-read from disk"', async () => {
    const mod = await import('./providerModelCache.js')
    mod.putProviderModelEntry(entry('openrouter', NOW, ['a', 'b']))
    expect(mod.getProviderModelEntry('openrouter')).not.toBeNull()

    mod.resetProviderModelCache()
    // A reset that silently reloaded the persisted file made "cold cache"
    // impossible, which broke the model-recovery path and its tests.
    expect(mod.getProviderModelEntry('openrouter')).toBeNull()
    expect(mod.isProviderModelCacheSuppressed()).toBe(true)

    mod.reloadProviderModelCache()
    expect(mod.isProviderModelCacheSuppressed()).toBe(false)
  })

  test('a write after a reset is visible again', async () => {
    const mod = await import('./providerModelCache.js')
    mod.resetProviderModelCache()
    mod.putProviderModelEntry(entry('groq', NOW, ['x']))
    expect(mod.getProviderModelEntry('groq')?.ids).toEqual(['x'])
    mod.resetProviderModelCache()
  })
})
