import { describe, expect, test } from 'bun:test'
import {
  formatPathFixHint,
  getTovyrPathCandidates,
  missingPathDirs,
  pathContainsDir,
  pathEntries,
  summarizeInstallPathState,
} from '../../../../scripts/tovyr-install-checks.js'

describe('installChecks', () => {
  test('getTovyrPathCandidates includes local bin and npm global', () => {
    const dirs = getTovyrPathCandidates({
      USERPROFILE: 'C:\\Users\\test',
      APPDATA: 'C:\\Users\\test\\AppData\\Roaming',
    })
    expect(dirs).toContain('C:\\Users\\test\\.local\\bin')
    expect(dirs).toContain('C:\\Users\\test\\AppData\\Roaming\\npm')
  })

  test('pathContainsDir is case-insensitive on Windows', () => {
    const envPath = 'C:\\Foo;C:\\Users\\test\\AppData\\Roaming\\npm'
    expect(
      pathContainsDir(envPath, 'C:\\Users\\test\\AppData\\Roaming\\npm'),
    ).toBe(true)
  })

  test('missingPathDirs lists dirs not on PATH', () => {
    const candidates = getTovyrPathCandidates({
      USERPROFILE: 'C:\\Users\\test',
      APPDATA: 'C:\\Users\\test\\AppData\\Roaming',
    })
    const missing = missingPathDirs('C:\\Windows\\system32', candidates)
    expect(missing).toHaveLength(2)
  })

  test('formatPathFixHint suggests set PATH on win32', () => {
    const hint = formatPathFixHint(['C:\\a\\b'], 'win32')
    expect(hint).toContain('set PATH=%PATH%;C:\\a\\b')
  })

  test('pathEntries splits semicolon-separated PATH', () => {
    expect(pathEntries('a;b;c')).toEqual(['a', 'b', 'c'])
  })

  test('summarizeInstallPathState reports missing PATH when shim dirs absent', () => {
    const state = summarizeInstallPathState({
      USERPROFILE: 'C:\\Users\\test',
      APPDATA: 'C:\\Users\\test\\AppData\\Roaming',
      PATH: 'C:\\Windows',
    })
    expect(state.pathOk).toBe(false)
    expect(state.missingPathDirs.length).toBeGreaterThan(0)
    expect(state.pathFixHint).toContain('set PATH')
  })
})
