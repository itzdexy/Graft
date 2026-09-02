import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findLayoutViolations } from './check-source-layout.js'

const fixtures = []

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true })
  }
})

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'tovyr-layout-'))
  fixtures.push(root)
  return root
}

describe('source layout check', () => {
  test('reports legacy source roots, the Chrome extension, and artifacts', () => {
    const root = makeFixture()
    mkdirSync(join(root, 'commands'))
    mkdirSync(join(root, 'chrome-extension'))
    writeFileSync(join(root, 'status.txt'), 'local command output')

    expect(findLayoutViolations(root)).toEqual([
      'chrome-extension/',
      'commands/',
      'status.txt',
    ])
  })

  test('accepts application code under src and infrastructure at the root', () => {
    const root = makeFixture()
    mkdirSync(join(root, 'src', 'commands'), { recursive: true })
    mkdirSync(join(root, 'scripts'))
    mkdirSync(join(root, 'assets'))

    expect(findLayoutViolations(root)).toEqual([])
  })
})
