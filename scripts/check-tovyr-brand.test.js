import { describe, expect, test } from 'bun:test'
import { scanText } from './check-tovyr-brand.js'

describe('scanText', () => {
  test('rejects the legacy product name in maintained copy', () => {
    const legacyName = ['Bl', 'ink'].join('')

    expect(scanText(`Welcome to ${legacyName}`, 'README.md')).toContain(
      'legacy product name',
    )
  })

  test('rejects the stale Tovyr repository owner', () => {
    const staleOwner = ['its', 'dexy'].join('')

    expect(
      scanText(`https://github.com/${staleOwner}/Tovyr`, 'README.md'),
    ).toContain('stale repository reference')
  })

  test('allows unrelated protocol language and third-party Claude names', () => {
    expect(scanText('browser blink event', 'vendor/protocol.md')).toEqual([])
    expect(
      scanText('@anthropic-ai/claude-agent-sdk', 'package.json'),
    ).toEqual([])
  })
})
