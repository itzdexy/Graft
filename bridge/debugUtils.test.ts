import { describe, expect, test } from 'bun:test'
import { redactSecretsForLogs } from './debugUtils.js'

describe('debugUtils redaction', () => {
  test('redacts FreeModel keys', () => {
    const out = redactSecretsForLogs('key=fe_oa_abcdefghijklmnopqrstuvwxyz')
    expect(out).not.toContain('abcdefghijklmnopqrstuvwxyz')
    expect(out).toContain('[REDACTED]')
  })

  test('redacts Anthropic keys', () => {
    const out = redactSecretsForLogs('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')
    expect(out).toContain('[REDACTED]')
  })

  test('redacts JSON secret fields', () => {
    const out = redactSecretsForLogs(
      '{"access_token":"verylongsecrettokenvalue1234567890"}',
    )
    expect(out).not.toContain('verylongsecrettokenvalue')
  })

  test('redacts env assignments in shell commands', () => {
    const out = redactSecretsForLogs('ANTHROPIC_API_KEY=sk-ant-abc123 npm test')
    expect(out).toContain('ANTHROPIC_API_KEY=[REDACTED]')
  })
})
