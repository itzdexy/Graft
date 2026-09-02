/**
 * Test-only bootstrap: pin the Tovyr home to a throwaway directory.
 *
 * Registered under `[test] preload` in bunfig.toml. The top-level `preload`
 * key does NOT apply to `bun test` -- Bun keeps the two lists separate -- so
 * this cannot live in src/build/preload.ts.
 *
 * Without it, anything resolving through getTovyrHome() writes into the
 * developer's real ~/.tovyr during a test run. That is not hypothetical:
 * src/services/tovyr/buddy/memory.search.test.ts had deposited 204
 * `memory-_nonexistent_buddy_merge_<timestamp>.json` files there, one more on
 * every run, because its cwd fixture is a throwaway path but the home it wrote
 * to was the real one.
 *
 * Deliberately minimal. The full runtime preload sets NODE_ENV, credential
 * aliases and renderer flags that tests should not silently inherit; only the
 * home redirect belongs here.
 */
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A test that sets up its own home still wins.
if (!process.env.TOVYR_HOME) {
  // Keyed by pid so concurrent test processes cannot clobber each other.
  const testHome = join(tmpdir(), `tovyr-test-home-${process.pid}`)
  mkdirSync(testHome, { recursive: true })
  process.env.TOVYR_HOME = testHome
  // getTovyrHome() falls back to HOME, then USERPROFILE, before os.homedir().
  // On Git Bash HOME is always set, so pinning TOVYR_HOME alone leaves every
  // one of those fallbacks pointing at the real home.
  process.env.HOME = testHome
  process.env.USERPROFILE = testHome
}
