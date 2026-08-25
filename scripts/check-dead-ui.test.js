import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

test('does not treat test-only comments or strings as production reachability', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'tovyr-dead-ui-'))
  try {
    mkdirSync(join(fixture, 'components', 'tovyr'), { recursive: true })
    writeFileSync(
      join(fixture, 'components', 'tovyr', 'TovyrGhost.tsx'),
      'export function TovyrGhost() { return null }\n',
    )
    writeFileSync(
      join(fixture, 'components', 'tovyr', 'TovyrGhost.test.tsx'),
      "// TovyrGhost is mentioned only by this test\\nconst fixture = '<TovyrGhost />'\\n",
    )
    mkdirSync(join(fixture, 'services'), { recursive: true })
    writeFileSync(
      join(fixture, 'services', 'notes.ts'),
      "import { TovyrGhost } from '../components/tovyr/TovyrGhost.js'\n/* TovyrGhost is not mounted */\nconst label = 'TovyrGhost'\n",
    )

    const result = Bun.spawnSync({
      cmd: [process.execPath, join(process.cwd(), 'scripts/check-dead-ui.js')],
      cwd: fixture,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr.toString()).toContain('TovyrGhost')
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
