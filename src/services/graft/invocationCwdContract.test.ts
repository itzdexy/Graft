import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..', '..')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('Graft invocation-directory contract', () => {
  test('repo command shims capture and lock the caller directory', () => {
    for (const path of ['graft.cmd', 'bin/graft.cmd']) {
      const text = source(path)
      expect(text).toContain('GRAFT_INVOKE_CWD=%CD%')
      expect(text).toContain('GRAFT_INVOKE_CWD_LOCKED=1')
    }
  })

  test('PowerShell launcher preserves a directory locked by an outer shim', () => {
    const text = source('bin/graft.ps1')
    expect(text).toContain("$env:GRAFT_INVOKE_CWD_LOCKED -ne '1'")
    expect(text).toContain("$env:GRAFT_INVOKE_CWD = (Get-Location).Path")
  })

  test('installed cmd and PowerShell shims capture the caller directory', () => {
    const text = source('bin/install-graft.ps1')
    expect(text).toContain('set "GRAFT_INVOKE_CWD=%CD%"')
    expect(text).toContain("`$env:GRAFT_INVOKE_CWD = (Get-Location).Path")
    expect(text).toContain("`$env:GRAFT_INVOKE_CWD_LOCKED = '1'")
  })

  test('new-window launches explicitly forward the caller directory', () => {
    const text = source('scripts/graft-windows-launcher.js')
    expect(text).toContain('GRAFT_INVOKE_CWD: cwd')
    expect(text).toContain("GRAFT_INVOKE_CWD_LOCKED: '1'")
  })

  test('entrypoint fails closed instead of treating the package as the project', () => {
    const missing = join(
      root,
      '.cache',
      `definitely-missing-invocation-folder-${process.pid}`,
    )
    const result = spawnSync(
      process.execPath,
      [join(root, 'src', 'entrypoints', 'cli.tsx'), '--version'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          GRAFT_INVOKE_CWD: missing,
          GRAFT_INVOKE_CWD_LOCKED: '1',
        },
      },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'Graft could not open the folder it was launched from',
    )
  })
})
