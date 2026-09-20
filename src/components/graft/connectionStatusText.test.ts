import { describe, expect, test } from 'bun:test'
import { describeConnectionStatus } from './connectionStatusText.js'

describe('describeConnectionStatus', () => {
  test('healthy connections show no status text (model speaks)', () => {
    expect(
      describeConnectionStatus('ready', {
        providerId: 'openrouter',
        providerLabel: 'OpenRouter',
      }),
    ).toBeNull()
  })

  test('checking names the provider being probed', () => {
    expect(
      describeConnectionStatus('checking', {
        providerId: 'ollama',
        providerLabel: 'Ollama',
      }),
    ).toBe('checking Ollama…')
  })

  test('local offline tells the user how to recover', () => {
    expect(
      describeConnectionStatus('offline', {
        providerId: 'ollama',
        providerLabel: 'Ollama',
      }),
    ).toBe('ollama unreachable — run ollama serve')
  })

  test('remote offline points at the network, not the key', () => {
    expect(
      describeConnectionStatus('offline', {
        providerId: 'openrouter',
        providerLabel: 'OpenRouter',
      }),
    ).toBe('offline — check network')
  })

  test('invalid keys point at /provider, unconfigured at onboarding', () => {
    expect(
      describeConnectionStatus('invalid', {
        providerId: 'openrouter',
        providerLabel: 'OpenRouter',
      }),
    ).toBe('check key — /provider')
    expect(
      describeConnectionStatus('unconfigured', {
        providerId: '',
        providerLabel: '',
      }),
    ).toBe('no provider — /provider to connect')
  })

  test('limited and degraded stay short enough for one row', () => {
    const limited = describeConnectionStatus('limited', {
      providerId: 'openrouter',
      providerLabel: 'OpenRouter',
    })
    expect(limited).toBe('quota limited')
    const degraded = describeConnectionStatus('degraded', {
      providerId: 'openrouter',
      providerLabel: 'OpenRouter',
      detail: 'slow upstream, retrying',
    })
    expect(degraded).toBe('slow upstream, retrying')
  })
})
