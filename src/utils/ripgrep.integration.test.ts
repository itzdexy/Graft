import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ripGrep } from './ripgrep.js'
import { findSystemRipgrep } from '../../scripts/graft-ripgrep.js'

test.skipIf(!findSystemRipgrep())('source runtime searches real files using installed ripgrep', async () => {
  const root = mkdtempSync(join(tmpdir(), 'graft search '))
  try {
    writeFileSync(join(root, 'sum.js'), 'export const total = 5\n')
    const files = await ripGrep(['--files', '--glob', '*.js'], root, new AbortController().signal)
    expect(files.some(file => file.endsWith('sum.js'))).toBe(true)
    const hits = await ripGrep(['--line-number', 'total'], root, new AbortController().signal)
    expect(hits.some(hit => hit.includes('export const total = 5'))).toBe(true)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
