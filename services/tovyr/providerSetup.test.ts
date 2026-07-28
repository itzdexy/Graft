import { describe, expect, test } from 'bun:test'
import {
  classifyCredentialProbe,
  formatConnectedModelMessage,
  getOfficialProviderLogin,
} from './providerSetup.js'

describe('provider setup flow', () => {
  test('offers official login only for supported direct providers', () => {
    expect(getOfficialProviderLogin('openai')?.command).toContain('codex')
    expect(getOfficialProviderLogin('google')?.command).toContain('gemini-cli')
    expect(getOfficialProviderLogin('anthropic')?.command).toContain(
      'claude-subscription',
    )
    expect(getOfficialProviderLogin('openrouter')).toBeNull()
  })

  test('rejects authentication failures without claiming configuration', () => {
    expect(classifyCredentialProbe([401], 'OpenAI')).toEqual({
      ok: false,
      verified: false,
      message: 'OpenAI rejected that API key. Check it and try again.',
    })
    expect(classifyCredentialProbe([403], 'Anthropic').ok).toBe(false)
    expect(classifyCredentialProbe([200, 401], 'OpenAI').ok).toBe(false)
  })

  test('distinguishes verified and reachable-only providers', () => {
    expect(classifyCredentialProbe([200], 'OpenRouter').verified).toBe(true)
    expect(classifyCredentialProbe([404], 'Gateway')).toEqual({
      ok: true,
      verified: false,
      message:
        'Gateway is reachable. The key will be fully checked on the first request.',
    })
    expect(classifyCredentialProbe([], 'Gateway').ok).toBe(false)
  })

  test('uses a short, actionable chat handoff', () => {
    const message = formatConnectedModelMessage({
      providerLabel: 'OpenRouter',
      modelLabel: 'GPT-5.6',
    })
    expect(message).toContain('AI connected.')
    expect(message).toContain('OpenRouter · GPT-5.6')
    expect(message).toContain('Talk to Tovyr')
  })
})
