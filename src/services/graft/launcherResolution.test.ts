import { afterEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getGraftPackageRoot,
  resolveGraftCliEntry,
  resolveBunExecutable,
} from '../../../scripts/graft-package-root.js'

describe('Graft launcher Bun resolution', () => {
  const originalBunCommand = process.env.GRAFT_BUN_CMD
  const originalBunInstall = process.env.BUN_INSTALL

  afterEach(() => {
    if (originalBunCommand === undefined) delete process.env.GRAFT_BUN_CMD
    else process.env.GRAFT_BUN_CMD = originalBunCommand
    if (originalBunInstall === undefined) delete process.env.BUN_INSTALL
    else process.env.BUN_INSTALL = originalBunInstall
  })

  test('ignores a stale installer override and uses the bundled runtime', () => {
    const installRoot = join(
      process.env.LOCALAPPDATA ?? 'C:\\Users\\test\\AppData\\Local',
      'Programs',
      'Graft',
      '.runtime',
    )
    const bundledBun = join(installRoot, 'bin', 'bun.exe')

    process.env.GRAFT_BUN_CMD = join(
      dirnameForTest(installRoot),
      'runtime',
      'bin',
      'bun.exe',
    )
    process.env.BUN_INSTALL = installRoot

    // This assertion is meaningful on the installed Windows test machine.
    // On other platforms the nonexistent fixture falls through to normal
    // system discovery rather than trusting the stale override.
    if (process.platform === 'win32' && Bun.file(bundledBun).size > 0) {
      expect(resolveBunExecutable()).toBe(bundledBun)
    } else {
      expect(resolveBunExecutable()).not.toBe(process.env.GRAFT_BUN_CMD)
    }
  })

  test('ignores an existing directory that is not a Graft package root', () => {
    process.env.GRAFT_PACKAGE_ROOT =
      process.env.LOCALAPPDATA ?? 'C:\\Users\\test\\AppData\\Local'
    process.env.GRAFT_SRC = process.env.GRAFT_PACKAGE_ROOT

    expect(getGraftPackageRoot()).not.toBe(process.env.GRAFT_PACKAGE_ROOT)
    expect(existsSync(join(getGraftPackageRoot(), 'src', 'entrypoints', 'cli.tsx'))).toBe(true)
  })

  test('uses the bundled Bun runtime when source is not in the npm package', () => {
    const root = mkdtempSync(join(tmpdir(), 'graft-runtime-resolution-'))
    try {
      mkdirSync(join(root, 'runtime'))
      writeFileSync(join(root, 'runtime', 'cli.js'), 'console.log("Graft")\n')
      expect(resolveGraftCliEntry(root)).toBe(join(root, 'runtime', 'cli.js'))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

function dirnameForTest(path: string): string {
  return path.replace(/[\\/]\.runtime$/, '')
}
