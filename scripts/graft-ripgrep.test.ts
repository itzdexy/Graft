import { afterEach, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { findSystemRipgrep } from './graft-ripgrep.js'
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
test('finds an executable in a PATH directory containing spaces', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'graft rg ')); roots.push(root)
  const binary = path.join(root, process.platform === 'win32' ? 'rg.exe' : 'rg')
  writeFileSync(binary, 'fixture'); chmodSync(binary, 0o755)
  expect(findSystemRipgrep(root)).toBe(binary)
})
test('ignores empty and relative PATH entries', () => {
  expect(findSystemRipgrep(['', '.', 'relative', ''].join(path.delimiter))).toBeNull()
})
