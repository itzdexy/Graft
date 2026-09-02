import { describe, expect, test } from 'bun:test'
import { chromiumCandidates, findChromium } from './chromiumFinder.js'
import { parsePageTargets, unwrapEvaluateString } from './cdpClient.js'

const WIN_ENV = {
  ProgramFiles: 'C:\\Program Files',
  'ProgramFiles(x86)': 'C:\\Program Files (x86)',
  LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local',
} as NodeJS.ProcessEnv

describe('chromiumFinder', () => {
  test('offers Windows candidates including the stock Edge fallback', () => {
    const paths = chromiumCandidates(WIN_ENV, 'win32').map(c => c.path)
    expect(paths.some(p => p.includes('chrome.exe'))).toBe(true)
    // Edge ships with Windows, so it is the reliable last resort.
    expect(paths.some(p => p.includes('msedge.exe'))).toBe(true)
    expect(paths.some(p => p.includes('brave.exe'))).toBe(true)
  })

  test('respects ProgramFiles overrides rather than hardcoding C:', () => {
    const paths = chromiumCandidates(
      { ...WIN_ENV, ProgramFiles: 'D:\\Apps' },
      'win32',
    ).map(c => c.path)
    expect(paths.some(p => p.startsWith('D:\\Apps'))).toBe(true)
  })

  test('returns platform-appropriate candidates', () => {
    expect(
      chromiumCandidates({}, 'darwin').every(c => c.path.startsWith('/')),
    ).toBe(true)
    expect(chromiumCandidates({}, 'linux').some(c => c.path.includes('chromium'))).toBe(
      true,
    )
  })

  test('picks the first candidate that exists', () => {
    const found = findChromium(
      path => path.includes('msedge.exe'),
      WIN_ENV,
      'win32',
    )
    expect(found?.name).toBe('Edge')
  })

  test('returns null when nothing is installed', () => {
    expect(findChromium(() => false, WIN_ENV, 'win32')).toBeNull()
  })

  test('TOVYR_BROWSER_PATH overrides detection entirely', () => {
    const found = findChromium(
      () => true,
      { ...WIN_ENV, TOVYR_BROWSER_PATH: 'D:\\portable\\chrome.exe' },
      'win32',
    )
    // Taken as given: a missing override is a config error worth surfacing,
    // not a reason to silently launch a different browser.
    expect(found?.path).toBe('D:\\portable\\chrome.exe')
  })
})

describe('parsePageTargets', () => {
  const page = {
    id: 'A',
    type: 'page',
    title: 'T',
    url: 'https://x.test/',
    webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/A',
  }

  test('keeps page targets', () => {
    expect(parsePageTargets([page])).toHaveLength(1)
  })

  test('drops service workers and extensions', () => {
    expect(
      parsePageTargets([
        { ...page, type: 'service_worker' },
        { ...page, type: 'background_page' },
      ]),
    ).toEqual([])
  })

  test('drops entries with no debugger socket', () => {
    const { webSocketDebuggerUrl: _omitted, ...noSocket } = page
    expect(parsePageTargets([noSocket])).toEqual([])
  })

  test('survives junk payloads', () => {
    expect(parsePageTargets(null)).toEqual([])
    expect(parsePageTargets({})).toEqual([])
    expect(parsePageTargets([null, 42, 'x'])).toEqual([])
  })
})

describe('unwrapEvaluateString', () => {
  test('reads a string value', () => {
    expect(unwrapEvaluateString({ result: { value: 'complete' } })).toBe(
      'complete',
    )
  })

  test('coerces non-strings', () => {
    expect(unwrapEvaluateString({ result: { value: 42 } })).toBe('42')
  })

  test('returns empty for null/undefined rather than "null"', () => {
    expect(unwrapEvaluateString({ result: { value: null } })).toBe('')
    expect(unwrapEvaluateString({})).toBe('')
  })
})
