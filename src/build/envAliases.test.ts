import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')

/**
 * Tovyr-named credentials are aliases applied by the Bun preload, not a rename:
 * the Anthropic SDK and the OpenAI-compat proxy read the ANTHROPIC_* names
 * downstream. These run a real child process so the preload actually executes —
 * asserting on the source text would not prove the mapping happens.
 */
function envInChild(
  env: Record<string, string>,
  read: string[],
): Record<string, string> {
  const script = `console.log(JSON.stringify({${read
    .map(name => `${JSON.stringify(name)}: process.env[${JSON.stringify(name)}] ?? null`)
    .join(',')}}))`
  const result = spawnSync('bun', ['-e', script], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
  const line = (result.stdout || '').trim().split('\n').pop() ?? '{}'
  return JSON.parse(line)
}

describe('Tovyr credential env aliases', () => {
  test('TOVYR_AUTH_TOKEN populates ANTHROPIC_AUTH_TOKEN', () => {
    const out = envInChild(
      { TOVYR_AUTH_TOKEN: 'tovyr-token-1' },
      ['ANTHROPIC_AUTH_TOKEN'],
    )
    expect(out.ANTHROPIC_AUTH_TOKEN).toBe('tovyr-token-1')
  })

  test('the Tovyr name wins over a stale Anthropic value', () => {
    // A leftover ANTHROPIC_* in a shell profile must not beat the value the
    // user just set for Tovyr.
    const out = envInChild(
      { TOVYR_AUTH_TOKEN: 'from-tovyr', ANTHROPIC_AUTH_TOKEN: 'stale' },
      ['ANTHROPIC_AUTH_TOKEN'],
    )
    expect(out.ANTHROPIC_AUTH_TOKEN).toBe('from-tovyr')
  })

  test('an existing Anthropic value survives when no Tovyr name is set', () => {
    const out = envInChild({ ANTHROPIC_AUTH_TOKEN: 'only-anthropic' }, [
      'ANTHROPIC_AUTH_TOKEN',
    ])
    expect(out.ANTHROPIC_AUTH_TOKEN).toBe('only-anthropic')
  })

  test('an empty Tovyr value does not blank an existing credential', () => {
    const out = envInChild(
      { TOVYR_AUTH_TOKEN: '', ANTHROPIC_AUTH_TOKEN: 'keep-me' },
      ['ANTHROPIC_AUTH_TOKEN'],
    )
    expect(out.ANTHROPIC_AUTH_TOKEN).toBe('keep-me')
  })

  test('base url and model alias too', () => {
    const out = envInChild(
      {
        TOVYR_BASE_URL: 'https://example.test/api',
        TOVYR_MODEL: 'some/model',
      },
      ['ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL'],
    )
    expect(out.ANTHROPIC_BASE_URL).toBe('https://example.test/api')
    expect(out.ANTHROPIC_MODEL).toBe('some/model')
  })
})
