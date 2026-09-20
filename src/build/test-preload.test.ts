import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { readFileSync } from 'node:fs'
import { getGraftHome } from '../../scripts/graft-home.js'

/**
 * Guards the isolation in build/test-preload.ts.
 *
 * The failure this prevents is silent and cumulative: a test writes through
 * getGraftHome(), the write succeeds, the test passes, and the file lands in
 * the developer's real ~/.graft. 204 of them accumulated that way before
 * anyone noticed, because nothing in a green suite points at it.
 */
describe('test home isolation', () => {
  test('GRAFT_HOME points inside the OS temp dir, not the real home', () => {
    const home = getGraftHome()
    expect(home).toBeTruthy()
    expect(home.startsWith(tmpdir())).toBe(true)
  })

  test('HOME and USERPROFILE are redirected too', () => {
    // getGraftHome() falls back to these, so leaving either pointing at the
    // real home defeats the redirect for any code path that reads them.
    for (const name of ['HOME', 'USERPROFILE'] as const) {
      const value = process.env[name]
      if (value === undefined) continue
      expect(value.startsWith(tmpdir())).toBe(true)
    }
  })

  test('bunfig registers the preload under [test], not only at top level', () => {
    // Bun keeps the two preload lists separate. A top-level-only registration
    // type-checks, lints, and does nothing -- which is exactly how the leak
    // survived its first fix.
    const bunfig = readFileSync(
      new URL('../../bunfig.toml', import.meta.url),
      'utf8',
    )
    const testSection = bunfig.slice(bunfig.indexOf('[test]'))
    expect(testSection).toContain('src/build/test-preload.ts')
  })
})
