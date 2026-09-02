import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createManagedState } from './managed-state.js'

const homes = []
const record = {
  version: 1,
  appId: 'chatgpt',
  integrationKind: 'model-routing',
  gateway: { host: '127.0.0.1', port: 11434 },
  managedFields: [],
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
}

function tempHome() {
  const home = mkdtempSync(join(tmpdir(), 'tovyr-app-state-'))
  homes.push(home)
  return home
}

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
})

describe('Tovyr managed application state', () => {
  test('stores a redacted connection manifest with owner-only file mode', () => {
    const state = createManagedState(tempHome())
    state.saveConnection({ ...record, gatewayToken: 'do-not-store-this', nested: { apiKey: 'also-secret' } })
    expect(readFileSync(state.connectionPath('chatgpt'), 'utf8')).not.toContain('do-not-store-this')
    expect(readFileSync(state.connectionPath('chatgpt'), 'utf8')).not.toContain('also-secret')
    expect(state.readConnection('chatgpt')).toMatchObject({ appId: 'chatgpt' })
    if (process.platform !== 'win32') {
      expect(statSync(state.connectionPath('chatgpt')).mode & 0o077).toBe(0)
    }
  })

  test('restores only a recorded backup to its original target', () => {
    const home = tempHome()
    const state = createManagedState(home)
    const configPath = join(home, 'config.json')
    state.recordBackup('codex', configPath, 'before')
    const writes = []
    expect(state.restoreBackup('codex', (path, content) => writes.push({ path, content })))
      .toEqual({ restored: true, path: configPath })
    expect(writes).toEqual([{ path: configPath, content: 'before' }])
  })

  test('reports malformed manifests without deleting them', () => {
    const state = createManagedState(tempHome())
    state.saveConnection(record)
    const path = state.connectionPath('chatgpt')
    chmodSync(path, 0o600)
    // Keep the malformed bytes in place so callers can recover the file.
    writeFileSync(path, '{not-json')
    expect(state.readConnection('chatgpt')).toMatchObject({ error: 'invalid-manifest' })
    expect(readFileSync(path, 'utf8')).toBe('{not-json')
  })

  test('does not restore a backup to a caller-supplied mismatched target', () => {
    const state = createManagedState(tempHome())
    const original = join(tempHome(), 'original.json')
    state.recordBackup('codex', original, 'before')
    expect(state.restoreBackup('codex', () => { throw new Error('should not write') }, join(tempHome(), 'other.json')))
      .toMatchObject({ error: 'backup-target-mismatch' })
  })

  test('preserves the original connection when an atomic rename fails', () => {
    const home = tempHome()
    const state = createManagedState(home, { renameSync: () => { throw new Error('rename failed') } })
    expect(state.saveConnection(record)).toMatchObject({ error: 'write-failed' })
    expect(state.readConnection('chatgpt')).toBeNull()
  })
})
