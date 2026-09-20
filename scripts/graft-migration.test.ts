import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { migrateGraftSettings } from './graft-env.js'

test('migration preserves settings without replacing current values or copying profiles', () => {
  const home = mkdtempSync(join(tmpdir(), 'graft-migration-test-'))
  try {
    mkdirSync(join(home, '.tovyr', 'browser'), { recursive: true })
    writeFileSync(join(home, '.tovyr', 'settings.json'), '{"theme":"dark"}')
    writeFileSync(join(home, '.tovyr', 'browser', 'profile'), 'private fixture')
    migrateGraftSettings(home)
    expect(readFileSync(join(home, '.graft', 'settings.json'), 'utf8')).toBe('{"theme":"dark"}')
    expect(existsSync(join(home, '.graft', 'browser'))).toBe(false)
    writeFileSync(join(home, '.graft', 'settings.json'), '{"theme":"light"}')
    migrateGraftSettings(home)
    expect(readFileSync(join(home, '.graft', 'settings.json'), 'utf8')).toBe('{"theme":"light"}')
    expect(existsSync(join(home, '.tovyr', 'settings.json'))).toBe(true)
  } finally { rmSync(home, { recursive: true, force: true }) }
})
