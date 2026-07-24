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

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true })
    if (home) rmSync(home, { recursive: true, force: true })
    cwd = ''
    home = ''
  })

  test('stores toggle under project .blink/superthink/toggle.json', () => {
    cwd = mkdtempSync(join(tmpdir(), 'blink-st-state-'))
    expect(isSuperthinkEnabled(cwd)).toBe(false)

    setSuperthinkEnabled(cwd, true)
    const togglePath = join(cwd, '.blink', 'superthink', 'toggle.json')
    expect(existsSync(togglePath)).toBe(true)
    expect(isSuperthinkEnabled(cwd)).toBe(true)

    setSuperthinkEnabled(cwd, false)
    expect(isSuperthinkEnabled(cwd)).toBe(false)
    expect(JSON.parse(readFileSync(togglePath, 'utf8')).enabled).toBe(false)
  })

  test('notifies subscribers when toggled off', () => {
    cwd = mkdtempSync(join(tmpdir(), 'blink-st-state-'))
    setSuperthinkEnabled(cwd, true)

    let enabled = isSuperthinkEnabled(cwd)
    const unsub = subscribeSuperthinkState(() => {
      enabled = isSuperthinkEnabled(cwd)
    })

    setSuperthinkEnabled(cwd, false)
    expect(enabled).toBe(false)
    unsub()
  })

  test('migrates legacy ~/.blink/superthink-<slug>.json', () => {
    cwd = mkdtempSync(join(tmpdir(), 'blink-st-state-'))
    home = mkdtempSync(join(tmpdir(), 'blink-st-home-'))
    process.env.HOME = home
    process.env.USERPROFILE = home

    const legacyDir = join(home, '.blink')
    mkdirSync(legacyDir, { recursive: true })
    const slug = cwd.replace(/[^a-zA-Z0-9]+/g, '_').slice(-80) || 'default'
    writeFileSync(
      join(legacyDir, `superthink-${slug}.json`),
      JSON.stringify({ enabled: true }),
      'utf8',
    )

    expect(isSuperthinkEnabled(cwd)).toBe(true)
    expect(existsSync(join(cwd, '.blink', 'superthink', 'toggle.json'))).toBe(true)
  })
})
