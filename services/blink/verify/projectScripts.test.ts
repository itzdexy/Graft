import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { detectPackageManager, detectProjectScripts } from './projectScripts.js'

describe('projectScripts', () => {
  test('detects npm scripts from package.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'blink-verify-'))
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        scripts: {
          test: 'bun test services',
          lint: 'eslint .',
          build: 'tsc',
          typecheck: 'tsc --noEmit',
        },
      }),
    )
    writeFileSync(join(dir, 'bun.lock'), '')
    const scripts = detectProjectScripts(dir)
    expect(scripts.checks.length).toBeGreaterThanOrEqual(3)
    expect(scripts.packageManager).toBe('bun')
    expect(scripts.checks.some(c => c.kind === 'test')).toBe(true)
    expect(scripts.checks.some(c => c.kind === 'lint')).toBe(true)
  })

  test('detectPackageManager prefers bun.lock', () => {
    const dir = mkdtempSync(join(tmpdir(), 'blink-pm-'))
    writeFileSync(join(dir, 'bun.lock'), '')
    writeFileSync(join(dir, 'package.json'), '{"scripts":{}}')
    expect(detectPackageManager(dir)).toBe('bun')
  })
})
