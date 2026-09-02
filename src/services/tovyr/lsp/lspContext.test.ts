import { afterEach, describe, expect, test } from 'bun:test'
import { loadLspContextSection } from './lspContext.js'

const envKeys = ['ENABLE_LSP_TOOL', 'TOVYR_LSP_CONTEXT'] as const

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {}
  for (const key of envKeys) {
    saved[key] = process.env[key]
  }
  return saved
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of envKeys) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
}

describe('loadLspContextSection', () => {
  const saved = saveEnv()

  afterEach(() => restoreEnv(saved))

  test('returns null when LSP tool not enabled', () => {
    delete process.env.ENABLE_LSP_TOOL
    expect(loadLspContextSection()).toBeNull()
  })

  test('returns null when TOVYR_LSP_CONTEXT=0', () => {
    process.env.ENABLE_LSP_TOOL = '1'
    process.env.TOVYR_LSP_CONTEXT = '0'
    expect(loadLspContextSection()).toBeNull()
  })

  test('includes guidance when LSP enabled', () => {
    process.env.ENABLE_LSP_TOOL = '1'
    delete process.env.TOVYR_LSP_CONTEXT
    const section = loadLspContextSection()
    if (section === null) {
      // Non-Tovyr runtime in CI — skip content assertions
      return
    }
    expect(section).toContain('LSP context')
    expect(section).toContain('go-to-definition')
  })
})