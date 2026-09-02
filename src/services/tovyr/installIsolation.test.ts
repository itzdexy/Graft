import { describe, expect, test } from 'bun:test'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  applyTovyrSettingsTune,
  getTovyrSettingsPath,
} from '../../../scripts/tovyr-tune-settings.js'

/**
 * Tovyr must never write into another product's configuration directory.
 *
 * applyTovyrSettingsTune() ran on every launch (bin/tovyr.js →
 * tovyr-prep-auth.js) and created + overwrote ~/.claude/settings.json, which
 * is Claude Code's file. That was the reported "installing Tovyr messes up
 * claude code cli" bug.
 */
describe('install isolation', () => {
  function withFakeHome<T>(fn: (home: string) => T): T {
    const home = mkdtempSync(join(tmpdir(), 'tovyr-iso-'))
    const prevUser = process.env.USERPROFILE
    const prevHome = process.env.HOME
    process.env.USERPROFILE = home
    process.env.HOME = home
    try {
      return fn(home)
    } finally {
      if (prevUser === undefined) delete process.env.USERPROFILE
      else process.env.USERPROFILE = prevUser
      if (prevHome === undefined) delete process.env.HOME
      else process.env.HOME = prevHome
      rmSync(home, { recursive: true, force: true })
    }
  }

  test('settings land in ~/.tovyr, not ~/.claude', () => {
    withFakeHome(home => {
      const written = applyTovyrSettingsTune()
      expect(written).toBe(join(home, '.tovyr', 'settings.json'))
      expect(existsSync(written)).toBe(true)
    })
  })

  test('the Claude Code config directory is never created', () => {
    withFakeHome(home => {
      applyTovyrSettingsTune()
      expect(existsSync(join(home, '.claude'))).toBe(false)
    })
  })

  test('an existing Claude Code settings file is left untouched', () => {
    withFakeHome(home => {
      const claudeDir = join(home, '.claude')
      const claudeSettings = join(claudeDir, 'settings.json')
      require('node:fs').mkdirSync(claudeDir, { recursive: true })
      const original = '{\n  "theme": "dark"\n}\n'
      require('node:fs').writeFileSync(claudeSettings, original)

      applyTovyrSettingsTune()

      expect(readFileSync(claudeSettings, 'utf8')).toBe(original)
    })
  })

  test('a corrupt settings file does not stop startup', () => {
    withFakeHome(home => {
      const dir = join(home, '.tovyr')
      require('node:fs').mkdirSync(dir, { recursive: true })
      require('node:fs').writeFileSync(join(dir, 'settings.json'), '{not json')

      expect(() => applyTovyrSettingsTune()).not.toThrow()
      expect(() =>
        JSON.parse(readFileSync(getTovyrSettingsPath(), 'utf8')),
      ).not.toThrow()
    })
  })

  test('the tune is idempotent across launches', () => {
    withFakeHome(() => {
      const path = applyTovyrSettingsTune()
      const first = readFileSync(path, 'utf8')
      applyTovyrSettingsTune()
      expect(readFileSync(path, 'utf8')).toBe(first)
    })
  })
})
