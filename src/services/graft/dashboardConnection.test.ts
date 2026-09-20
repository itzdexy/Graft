import { describe, expect, test } from 'bun:test'
import { resolveDashboardConnection } from '../../components/graft/GraftWorkspaceDashboard.js'

describe('Graft dashboard connection presentation', () => {
  test('never presents a stale provider snapshot as the active connection', () => {
    expect(
      resolveDashboardConnection({
        fallbackModel: 'Sonnet 5',
        connection: {
          state: 'degraded',
          providerId: 'anthropic',
          providerLabel: 'Anthropic',
          modelId: 'claude-sonnet-5',
        },
        active: {
          providerId: 'openai',
          label: 'OpenAI',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'openai/gpt-5.5',
          authMode: 'oauth',
        },
      }),
    ).toEqual({
      provider: 'OpenAI',
      model: 'openai/gpt-5.5',
      state: 'checking',
    })
  })

  test('does not show an old snapshot after the provider is disconnected', () => {
    expect(
      resolveDashboardConnection({
        fallbackModel: 'Local model',
        connection: {
          state: 'ready',
          providerId: 'anthropic',
          providerLabel: 'Anthropic',
          modelId: 'claude-sonnet-5',
        },
        active: null,
      }),
    ).toEqual({
      provider: undefined,
      model: 'Local model',
      state: 'unconfigured',
    })
  })
})
