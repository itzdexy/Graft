import { describe, expect, test } from 'bun:test'
import {
  TOVYR_CODE_BASELINE_NOTE,
  formatClaudeCodeHelp,
} from './claude-code.js'

describe('claude-code adapter', () => {
  test('baseline note uses Tovyr branding', () => {
    expect(TOVYR_CODE_BASELINE_NOTE).toContain('Tovyr')
    expect(TOVYR_CODE_BASELINE_NOTE).toContain('/guide')
  })

  test('help lists core slash commands', () => {
    const text = formatClaudeCodeHelp()
    expect(text).toContain('Tovyr')
    expect(text).toContain('/plan')
    expect(text).toContain('/mcp')
    expect(text).not.toContain('Tovyr (baseline')
  })
})
