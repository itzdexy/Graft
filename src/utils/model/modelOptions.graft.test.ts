import { describe, expect, test } from 'bun:test'
import { buildProviderModelOption } from './modelOptions.js'

describe('buildProviderModelOption', () => {
  test('keeps the provider wire id while correcting the visible Claude label', () => {
    const option = buildProviderModelOption('anthropic', {
      id: 'claude-opus-5',
      label: 'Opus 5',
      tier: 'opus',
      context: '1m',
    })

    expect(option.value).toBe('claude-opus-5')
    expect(option.label).toBe('Claude Opus 5')
    expect(option.description).toContain('Claude Opus 5')
  })
})
