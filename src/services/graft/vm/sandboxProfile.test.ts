import { describe, expect, test } from 'bun:test'
import {
  buildGuestScript,
  DEFAULT_SANDBOX_PROFILE,
  isValidSandboxId,
  sandboxDir,
} from './sandboxProfile.js'

/** The script is base64 all the way down; decode it to assert on it. */
function decodeLayers(script: string): string {
  let out = script
  for (let i = 0; i < 4; i++) {
    const payloads = [...out.matchAll(/printf %s '([A-Za-z0-9+/=]+)'/g)]
    if (payloads.length === 0) break
    for (const [, b64] of payloads) {
      out += '\n' + Buffer.from(b64, 'base64').toString('utf8')
    }
  }
  return out
}

describe('sandbox profiles', () => {
  test('isolated is the default', () => {
    expect(DEFAULT_SANDBOX_PROFILE).toBe('isolated')
  })

  test('isolated unshares user, mount, pid and net namespaces', () => {
    const script = buildGuestScript({
      profile: 'isolated',
      command: 'echo hi',
      sandboxId: 'abc',
    })
    expect(script).toContain('unshare')
    for (const flag of [
      '--user',
      '--map-root-user',
      '--mount',
      '--pid',
      '--fork',
      '--mount-proc',
      '--net',
    ]) {
      expect(script).toContain(flag)
    }
  })

  test('isolated hides the Windows drives with a tmpfs, not umount', () => {
    // /mnt is not a mountpoint -- its children are -- so `umount /mnt` says
    // "not mounted" and leaves every drive readable.
    const decoded = decodeLayers(
      buildGuestScript({
        profile: 'isolated',
        command: 'echo hi',
        sandboxId: 'abc',
      }),
    )
    expect(decoded).toContain('mount -t tmpfs')
    expect(decoded).toContain('none /mnt')
    expect(decoded).not.toContain('umount')
  })

  test('network: true keeps the drives hidden but restores DNS', () => {
    const decoded = decodeLayers(
      buildGuestScript({
        profile: 'isolated',
        command: 'echo hi',
        sandboxId: 'abc',
        network: true,
      }),
    )
    // WSL symlinks /etc/resolv.conf into /mnt/wsl, so the tmpfs takes DNS
    // down with the drives unless it is put back inside the tmpfs itself.
    expect(decoded).toContain('/mnt/wsl/resolv.conf')
    expect(decoded).toContain('mount -t tmpfs')
    const unshareLine = decoded
      .split('\n')
      .find(line => line.includes('unshare'))
    expect(unshareLine).not.toContain('--net')
  })

  test('isolated runs inside the sandbox directory, never under /mnt', () => {
    const decoded = decodeLayers(
      buildGuestScript({
        profile: 'isolated',
        command: 'echo hi',
        sandboxId: 'task7',
      }),
    )
    expect(decoded).toContain(`cd ${sandboxDir('task7')}`)
    expect(sandboxDir('task7').startsWith('/mnt')).toBe(false)
  })

  test('isolated applies memory, process and CPU caps', () => {
    const decoded = decodeLayers(
      buildGuestScript({
        profile: 'isolated',
        command: 'echo hi',
        sandboxId: 'abc',
        limits: { memoryMb: 64, maxProcesses: 8, cpuSeconds: 5 },
      }),
    )
    expect(decoded).toContain('ulimit -v 65536')
    expect(decoded).toContain('ulimit -u 8')
    expect(decoded).toContain('ulimit -t 5')
  })

  test('workspace does not unshare anything', () => {
    const script = buildGuestScript({
      profile: 'workspace',
      command: 'echo hi',
      cwd: '/mnt/c/Users/x',
    })
    expect(script).not.toContain('unshare')
    expect(decodeLayers(script)).toContain('/mnt/c/Users/x')
  })

  test('a command with quotes and newlines survives the trip', () => {
    // Everything crosses base64-encoded because the Windows -> wsl.exe argv
    // round-trip mangles embedded double quotes, and did so silently: the
    // guest printed whatever preceded the break and exited 0.
    const nasty = 'bash -c "echo \'a b\'"\nrm -rf $HOME; echo `id`'
    const script = buildGuestScript({
      profile: 'isolated',
      command: nasty,
      sandboxId: 'abc',
    })
    // The raw command must not appear in the script, only its encoding.
    expect(script).not.toContain('rm -rf')
    expect(decodeLayers(script)).toContain(nasty)
  })

  test('sandbox ids are restricted rather than escaped', () => {
    // They are interpolated into shell script text as a directory name.
    expect(isValidSandboxId('task-7_a')).toBe(true)
    for (const bad of [
      '',
      '../escape',
      'a b',
      'a;rm -rf /',
      '-leading-dash',
      '$(id)',
      'a'.repeat(65),
    ]) {
      expect(isValidSandboxId(bad)).toBe(false)
    }
  })

  test('an invalid sandbox id is rejected, not sanitised', () => {
    expect(() =>
      buildGuestScript({
        profile: 'isolated',
        command: 'echo hi',
        sandboxId: '../../etc',
      }),
    ).toThrow(/Invalid sandbox id/)
  })
})
