import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { formatProjectScan, scanProject } from './projectScan.js'

describe('projectScan', () => {
  test('detects Node project manifests and scripts', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'graft-scan-'))
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({
        name: 'demo',
        scripts: { test: 'vitest', build: 'tsc' },
        main: 'dist/index.js',
      }),
    )
    writeFileSync(join(cwd, 'tsconfig.json'), '{}')

    const scan = scanProject(cwd)
    expect(scan.projectType).toBe('Node.js / JavaScript')
    expect(scan.manifests).toContain('package.json')
    expect(scan.configFiles).toContain('tsconfig.json')
    expect(scan.scripts?.checks.length).toBeGreaterThan(0)

    const formatted = formatProjectScan(scan)
    expect(formatted).toContain('Node.js / JavaScript')
    expect(formatted).toContain('package.json')
  })

  test('returns empty manifests for empty temp dir', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'graft-scan-empty-'))
    const scan = scanProject(cwd)
    expect(scan.manifests).toEqual([])
    expect(scan.projectType).toBe('unknown')
  })
})
