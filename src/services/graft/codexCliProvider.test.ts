import { describe, expect, test } from 'bun:test'
import { buildIsolatedExternalCliEnv } from './codexCliProvider.js'

describe('external account transport isolation', () => {
  test('does not leak Graft Anthropic routing into Codex', () => {
    const env = buildIsolatedExternalCliEnv({
      PATH: 'bin',
      ANTHROPIC_API_KEY: 'secret',
      ANTHROPIC_BASE_URL: 'http://127.0.0.1',
      GRAFT_CODE_OAUTH_TOKEN: 'secret',
      GRAFT_ACTIVE_PROVIDER: 'anthropic',
      GRAFT_PROVIDER_AUTH_MODE: 'oauth',
      GRAFT_INVOKE_CWD: 'C:\\work',
    })
    expect(env.PATH).toBe('bin')
    expect(env.GRAFT_INVOKE_CWD).toBe('C:\\work')
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined()
    expect(env.GRAFT_CODE_OAUTH_TOKEN).toBeUndefined()
    expect(env.GRAFT_ACTIVE_PROVIDER).toBeUndefined()
  })
})
