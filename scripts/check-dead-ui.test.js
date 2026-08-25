import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

test('dead UI baseline is empty', () => {
  const source = readFileSync('scripts/check-dead-ui.js', 'utf8')

  expect(source).toContain('const BASELINE = new Set([])')
})

test('accepts the repository with no grandfathered dead UI', () => {
  const result = Bun.spawnSync({
    cmd: [process.execPath, 'scripts/check-dead-ui.js'],
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout.toString()).toContain(
    'check-dead-ui: no NEW unreferenced components (0 baselined).',
  )
})
