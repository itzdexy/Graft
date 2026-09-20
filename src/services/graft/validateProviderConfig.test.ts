import { describe, expect, test } from 'bun:test'
import {
  validateProviderConfig,
  formatProviderConfigIssues,
} from './validateProviderConfig.js'
import { getProvider } from '../../../scripts/graft-providers.js'

describe('validateProviderConfig', () => {
  test('flags missing key for cloud providers', () => {
    const issues = validateProviderConfig('anthropic', {
      active: 'anthropic',
      keys: {},
      models: {},
      custom: { baseUrl: '' },
      endpoints: {},
    })
    expect(issues.some(i => i.code === 'missing_key')).toBe(true)
  })

  test('ollama local provider does not require API key', () => {
    const issues = validateProviderConfig('ollama', {
      active: 'ollama',
      keys: {},
      models: {},
      custom: { baseUrl: '' },
      endpoints: {},
    })
    expect(issues.some(i => i.code === 'missing_key')).toBe(false)
    expect(getProvider('ollama')?.baseUrl).toContain('11434')
  })

  test('openai gateway stub requires base URL', () => {
    const issues = validateProviderConfig('openai', {
      active: 'openai',
      keys: { openai: 'sk-test-key-1234567890' },
      models: {},
      custom: { baseUrl: '' },
      endpoints: {},
    })
    expect(issues.some(i => i.code === 'missing_base_url')).toBe(true)
  })

  test('formatProviderConfigIssues renders fix hints', () => {
    const text = formatProviderConfigIssues([
      {
        code: 'missing_key',
        severity: 'error',
        message: 'No key',
        fix: 'graft auth login',
      },
    ])
    expect(text).toContain('No key')
    expect(text).toContain('graft auth login')
  })
})
