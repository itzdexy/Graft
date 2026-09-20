import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')

/**
 * Graft-named credentials are aliases applied by the Bun preload, not a rename:
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

describe('Graft credential env aliases', () => {
  test('GRAFT_AUTH_TOKEN populates ANTHROPIC_AUTH_TOKEN', () => {
    const out = envInChild(
      { GRAFT_AUTH_TOKEN: 'graft-token-1' },
      ['ANTHROPIC_AUTH_TOKEN'],
    )
    expect(out.ANTHROPIC_AUTH_TOKEN).toBe('graft-token-1')
  })

  test('the Graft name wins over a stale Anthropic value', () => {
    // A leftover ANTHROPIC_* in a shell profile must not beat the value the
    // user just set for Graft.
    const out = envInChild(
      { GRAFT_AUTH_TOKEN: 'from-graft', ANTHROPIC_AUTH_TOKEN: 'stale' },
      ['ANTHROPIC_AUTH_TOKEN'],
    )
    expect(out.ANTHROPIC_AUTH_TOKEN).toBe('from-graft')
  })

  test('an existing Anthropic value survives when no Graft name is set', () => {
    const out = envInChild({ ANTHROPIC_AUTH_TOKEN: 'only-anthropic' }, [
      'ANTHROPIC_AUTH_TOKEN',
    ])
    expect(out.ANTHROPIC_AUTH_TOKEN).toBe('only-anthropic')
  })

  test('an empty Graft value does not blank an existing credential', () => {
    const out = envInChild(
      { GRAFT_AUTH_TOKEN: '', ANTHROPIC_AUTH_TOKEN: 'keep-me' },
      ['ANTHROPIC_AUTH_TOKEN'],
    )
    expect(out.ANTHROPIC_AUTH_TOKEN).toBe('keep-me')
  })

  test('base url and model alias too', () => {
    const out = envInChild(
      {
        GRAFT_BASE_URL: 'https://example.test/api',
        GRAFT_MODEL: 'some/model',
      },
      ['ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL'],
    )
    expect(out.ANTHROPIC_BASE_URL).toBe('https://example.test/api')
    expect(out.ANTHROPIC_MODEL).toBe('some/model')
  })
})
