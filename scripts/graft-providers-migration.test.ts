import { describe, expect, test } from 'bun:test'
import {
  migrateProviderState,
  PROVIDER_STATE_SCHEMA_VERSION,
} from './graft-providers.js'

describe('provider state migration', () => {
  test('adds a schema marker without changing legacy provider data', () => {
    const migrated = migrateProviderState({
      active: 'ollama',
      keys: { freemodel: 'fe_oa_fixture-key-1234567890' },
      models: { ollama: 'qwen2.5-coder:1.5b' },
      auth: {},
      custom: { baseUrl: '' },
      endpoints: {},
    })

    expect(migrated.schemaVersion).toBeUndefined()
    expect(migrated.keys.freemodel).toBe('fe_oa_fixture-key-1234567890')
    expect(migrated.models.ollama).toBe('qwen2.5-coder:1.5b')
  })

  test('preserves an existing schema marker while reading', () => {
    expect(
      migrateProviderState({ schemaVersion: PROVIDER_STATE_SCHEMA_VERSION })
        .schemaVersion,
    ).toBe(PROVIDER_STATE_SCHEMA_VERSION)
  })

  test('migrates the retired openai_proxy id without dropping credentials', () => {
    const migrated = migrateProviderState({
      active: 'openai_proxy',
      keys: { openai_proxy: 'sk-fixture-key-1234567890' },
      models: { openai_proxy: 'gpt-test' },
      endpoints: { openai_proxy: 'http://127.0.0.1:9999/v1' },
    })

    expect(migrated.active).toBe('openai')
    expect(migrated.keys.openai).toBe('sk-fixture-key-1234567890')
    expect(migrated.models.openai).toBe('gpt-test')
    expect(migrated.endpoints.openai).toBe('http://127.0.0.1:9999/v1')
  })
})