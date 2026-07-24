import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  getBlinkPackageRoot,
  resolveBunExecutable,
} from '../../scripts/blink-package-root.js'

describe('Blink launcher Bun resolution', () => {
  const originalBunCommand = process.env.BLINK_BUN_CMD
  const originalBunInstall = process.env.BUN_INSTALL

  afterEach(() => {
    if (originalBunCommand === undefined) delete process.env.BLINK_BUN_CMD
    else process.env.BLINK_BUN_CMD = originalBunCommand
    if (originalBunInstall === undefined) delete process.env.BUN_INSTALL
    else process.env.BUN_INSTALL = originalBunInstall
  })

  test('ignores a stale installer override and uses the bundled runtime', () => {
    const installRoot = join(
      process.env.LOCALAPPDATA ?? 'C:\\Users\\test\\AppData\\Local',
      'Programs',
      'Blink',
      '.runtime',
    )
    const bundledBun = join(installRoot, 'bin', 'bun.exe')

    process.env.BLINK_BUN_CMD = join(
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
      expect(resolveBunExecutable()).not.toBe(process.env.BLINK_BUN_CMD)
    }
  })

  test('ignores an existing directory that is not a Blink package root', () => {
    process.env.BLINK_PACKAGE_ROOT =
      process.env.LOCALAPPDATA ?? 'C:\\Users\\test\\AppData\\Local'
    process.env.BLINK_SRC = process.env.BLINK_PACKAGE_ROOT

    expect(getBlinkPackageRoot()).not.toBe(process.env.BLINK_PACKAGE_ROOT)
    expect(getBlinkPackageRoot()).toEndWith('src')
  })
})

function dirnameForTest(path: string): string {
  return path.replace(/[\\/]\.runtime$/, '')
}
