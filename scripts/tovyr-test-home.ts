/** Isolated HOME/USERPROFILE harness for Tovyr subprocess and module tests. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const TEMP_PREFIX = 'tovyr-test-home-'

export type TovyrTestHome = {
  home: string
  env: Record<string, string>
  cleanup: () => void
}

export function createTovyrTestHome(): TovyrTestHome {
  const home = resolve(mkdtempSync(join(tmpdir(), TEMP_PREFIX)))
  const tempRoot = resolve(tmpdir())
  if (!home.startsWith(`${tempRoot}\\`) && !home.startsWith(`${tempRoot}/`)) {
    throw new Error(`Refusing to use a non-temporary Tovyr test home: ${home}`)
  }

  return {
    home,
    env: {
      HOME: home,
      USERPROFILE: home,
      TOVYR_HOME: home,
      TOVYR_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_AUTH_TOKEN: '',
    },
    cleanup: () => {
      // Keep cleanup constrained even if a caller accidentally mutates `home`.
      if (
        home.startsWith(`${tempRoot}\\${TEMP_PREFIX}`) ||
        home.startsWith(`${tempRoot}/${TEMP_PREFIX}`)
      ) {
        rmSync(home, { recursive: true, force: true })
      }
    },
  }
}

/** Snapshot a real-home path without emitting its possibly-secret contents. */
export function snapshotPath(path: string): { exists: boolean; bytes?: Uint8Array } {
  return existsSync(path)
    ? { exists: true, bytes: new Uint8Array(readFileSync(path)) }
    : { exists: false }
}

export function realHomePath(...segments: string[]): string {
  return join(resolve(process.env.USERPROFILE || process.env.HOME || tmpdir()), ...segments)
}
