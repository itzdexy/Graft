import { describe, expect, test } from 'bun:test'
import { getAppAdapter } from './catalog.js'
import {
  discoverApp,
  listAppStatuses,
  parseWindowsAppxExecutable,
} from './discovery.js'

const fakeRuntime = {
  platform: 'win32',
  runPowerShell: () => '',
  findCommand: () => null,
  exists: () => false,
}

describe('Graft application discovery', () => {
  test('discovers Microsoft Store ChatGPT as OpenAI.Codex', () => {
    const status = discoverApp(getAppAdapter('chatgpt'), {
      ...fakeRuntime,
      runPowerShell: () => 'C:\\Program Files\\WindowsApps\\OpenAI.Codex_x64\\app\\ChatGPT.exe\n',
      exists: path => path.endsWith('ChatGPT.exe'),
    })
    expect(status).toMatchObject({ id: 'chatgpt', readiness: 'ready' })
    expect(status.executable).toMatch(/app\\ChatGPT\.exe$/i)
  })

  test('keeps a known but unverified client manual', () => {
    expect(discoverApp(getAppAdapter('hermes-agent'), fakeRuntime)).toMatchObject({
      readiness: 'manual-setup', executable: null,
    })
  })

  test('keeps tool-only clients out of executable discovery', () => {
    const status = discoverApp(getAppAdapter('claude-desktop'), {
      ...fakeRuntime,
      findCommand: () => 'claude.exe',
    })
    expect(status).toMatchObject({ readiness: 'tool-only', executable: null })
  })

  test('reports unsupported versions when a discovered client is too old', () => {
    const adapter = { ...getAppAdapter('claude-code'), minimumVersion: '2.0.0' }
    const status = discoverApp(adapter, {
      ...fakeRuntime,
      platform: 'linux',
      findCommand: () => '/usr/bin/claude',
      version: '1.4.2',
    })
    expect(status).toMatchObject({ readiness: 'unsupported-version', executable: '/usr/bin/claude' })
    expect(status.reason).toContain('2.0.0')
  })

  test('returns only one status per catalog adapter', () => {
    const statuses = listAppStatuses({ ...fakeRuntime, platform: 'linux' })
    expect(statuses.length).toBeGreaterThan(10)
    expect(new Set(statuses.map(status => status.id)).size).toBe(statuses.length)
  })

  test('ignores non-executables and legacy installer output', () => {
    expect(parseWindowsAppxExecutable('ChatGPT Installer.exe\n')).toBeNull()
    expect(parseWindowsAppxExecutable('C:\\Program Files\\WindowsApps\\OpenAI.Codex\\app\\ChatGPT.exe\r\n'))
      .toMatch(/app\\ChatGPT\.exe$/i)
    expect(parseWindowsAppxExecutable('')).toBeNull()
  })
})
