import { afterEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  isSuperthinkEnabled,
  setSuperthinkEnabled,
  subscribeSuperthinkState,
} from './state.js'

describe('superthink toggle state', () => {
  let cwd = ''
  let home = ''
  const savedEnv = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    TOVYR_HOME: process.env.TOVYR_HOME,
  }

  /**
   * getTovyrHome() reads TOVYR_HOME *before* HOME and USERPROFILE, so a test
   * that redirects only the latter two is silently ignored whenever
   * TOVYR_HOME is set -- which it now always is, since build/test-preload.ts
   * pins it to keep the suite out of the developer's real home.
   */
  function useHome(dir: string): void {
    process.env.HOME = dir
    process.env.USERPROFILE = dir
    process.env.TOVYR_HOME = dir
  }

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    if (cwd) rmSync(cwd, { recursive: true, force: true })
    if (home) rmSync(home, { recursive: true, force: true })
    cwd = ''
    home = ''
  })

  test('stores toggle under project .tovyr/superthink/toggle.json', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-st-state-'))
    expect(isSuperthinkEnabled(cwd)).toBe(false)

    setSuperthinkEnabled(cwd, true)
    const togglePath = join(cwd, '.tovyr', 'superthink', 'toggle.json')
    expect(existsSync(togglePath)).toBe(true)
    expect(isSuperthinkEnabled(cwd)).toBe(true)

    setSuperthinkEnabled(cwd, false)
    expect(isSuperthinkEnabled(cwd)).toBe(false)
    expect(JSON.parse(readFileSync(togglePath, 'utf8')).enabled).toBe(false)
  })

  test('notifies subscribers when toggled off', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-st-state-'))
    setSuperthinkEnabled(cwd, true)

    let enabled = isSuperthinkEnabled(cwd)
    const unsub = subscribeSuperthinkState(() => {
      enabled = isSuperthinkEnabled(cwd)
    })

    setSuperthinkEnabled(cwd, false)
    expect(enabled).toBe(false)
    unsub()
  })

  test('migrates legacy ~/.tovyr/superthink-<slug>.json', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-st-state-'))
    home = mkdtempSync(join(tmpdir(), 'tovyr-st-home-'))
    useHome(home)

    const legacyDir = join(home, '.tovyr')
    mkdirSync(legacyDir, { recursive: true })
    const slug = cwd.replace(/[^a-zA-Z0-9]+/g, '_').slice(-80) || 'default'
    writeFileSync(
      join(legacyDir, `superthink-${slug}.json`),
      JSON.stringify({ enabled: true }),
      'utf8',
    )

    expect(isSuperthinkEnabled(cwd)).toBe(true)
    expect(existsSync(join(cwd, '.tovyr', 'superthink', 'toggle.json'))).toBe(true)
  })
})
