import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const NODE = Bun.which('node') ?? process.execPath

test('dead UI baseline is empty', () => {
  const source = readFileSync('scripts/check-dead-ui.js', 'utf8')

  expect(source).toContain('const BASELINE = new Set([])')
})

// Scans every component in the repo, which takes ~5s -- right on Bun's default
// 5000ms timeout, so this test failed roughly half the time on nothing.
test('accepts the repository with no grandfathered dead UI', () => {
  const result = Bun.spawnSync({
    cmd: [NODE, 'scripts/check-dead-ui.js'],
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout.toString()).toContain(
    'check-dead-ui: no NEW unreferenced components (0 baselined).',
  )
}, 60_000)

test('does not treat test-only comments or strings as production reachability', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'tovyr-dead-ui-'))
  try {
    mkdirSync(join(fixture, 'src', 'components', 'tovyr'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'components', 'tovyr', 'TovyrGhost.tsx'),
      'export function TovyrGhost() { return null }\n',
    )
    writeFileSync(
      join(fixture, 'src', 'components', 'tovyr', 'TovyrGhost.test.tsx'),
      "// TovyrGhost is mentioned only by this test\\nconst fixture = '<TovyrGhost />'\\n",
    )
    mkdirSync(join(fixture, 'src', 'services'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'services', 'notes.ts'),
      "import { TovyrGhost } from '../components/tovyr/TovyrGhost.js'\n/* TovyrGhost is not mounted */\nconst label = 'TovyrGhost'\n",
    )

    const result = Bun.spawnSync({
      cmd: [NODE, join(process.cwd(), 'scripts/check-dead-ui.js')],
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

test('rejects type-only, regex, and unused-value mentions as runtime reachability', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'tovyr-dead-ui-ast-'))
  try {
    mkdirSync(join(fixture, 'src', 'components', 'tovyr'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'components', 'tovyr', 'TovyrGhost.tsx'),
      'export function TovyrGhost() { return null }\n',
    )
    mkdirSync(join(fixture, 'src', 'services'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'services', 'mentions.tsx'),
      [
        "import type { TovyrGhost } from '../components/tovyr/TovyrGhost.js'",
        "import { TovyrGhost as Ghost } from '../components/tovyr/TovyrGhost.js'",
        'const pattern = /TovyrGhost/',
        'type Renderable = TovyrGhost',
        'const unused = Ghost',
      ].join('\n'),
    )

    const result = Bun.spawnSync({
      cmd: [NODE, join(process.cwd(), 'scripts/check-dead-ui.js')],
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

test('rejects unreachable, shadowed, and wrapper-only runtime mentions', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'tovyr-dead-ui-bindings-'))
  try {
    mkdirSync(join(fixture, 'src', 'components', 'tovyr'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'components', 'tovyr', 'TovyrGhost.tsx'),
      'export function TovyrGhost() { return null }\n',
    )
    mkdirSync(join(fixture, 'src', 'services'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'services', 'mentions.tsx'),
      [
        "import { TovyrGhost as Ghost } from '../components/tovyr/TovyrGhost.js'",
        'false && <Ghost />',
        'false ? <Ghost /> : null',
        'true ? null : <Ghost />',
        'const Wrapped = memo(Ghost)',
        'function hidden(Ghost: unknown) { return <Ghost /> }',
        'const scoped = () => { const Ghost = () => null; return <Ghost /> }',
        '{ function Ghost() { return null }; <Ghost /> }',
        '{ class Ghost {}; <Ghost /> }',
      ].join('\n'),
    )

    const result = Bun.spawnSync({
      cmd: [NODE, join(process.cwd(), 'scripts/check-dead-ui.js')],
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

test('accepts a wrapped imported component when it is actually mounted', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'tovyr-dead-ui-wrapper-'))
  try {
    mkdirSync(join(fixture, 'src', 'components', 'tovyr'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'components', 'tovyr', 'TovyrGhost.tsx'),
      'export function TovyrGhost() { return null }\n',
    )
    mkdirSync(join(fixture, 'src', 'services'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'services', 'live.tsx'),
      [
        "import { TovyrGhost as Ghost } from '../components/tovyr/TovyrGhost.js'",
        'const Wrapped = memo(Ghost)',
        'export const Live = () => <Wrapped />',
      ].join('\n'),
    )

    const result = Bun.spawnSync({
      cmd: [NODE, join(process.cwd(), 'scripts/check-dead-ui.js')],
      cwd: fixture,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(result.exitCode).toBe(0)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})

test('accepts a component passed to a JSX component-owner prop', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'tovyr-dead-ui-jsx-owner-'))
  try {
    mkdirSync(join(fixture, 'src', 'components', 'tovyr'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'components', 'tovyr', 'TovyrGhost.tsx'),
      'export function TovyrGhost() { return null }\n',
    )
    mkdirSync(join(fixture, 'src', 'services'), { recursive: true })
    writeFileSync(
      join(fixture, 'src', 'services', 'route.tsx'),
      [
        "import { TovyrGhost as Ghost } from '../components/tovyr/TovyrGhost.js'",
        'export const Route = () => <Router component={Ghost} />',
      ].join('\n'),
    )

    const result = Bun.spawnSync({
      cmd: [NODE, join(process.cwd(), 'scripts/check-dead-ui.js')],
      cwd: fixture,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(result.exitCode).toBe(0)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
