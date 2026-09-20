import { describe, expect, test } from 'bun:test'
import {
  GRAFT_CODE_BASELINE_NOTE,
  formatClaudeCodeHelp,
} from './claude-code.js'

describe('claude-code adapter', () => {
  test('baseline note uses Graft branding', () => {
    expect(GRAFT_CODE_BASELINE_NOTE).toContain('Graft')
    expect(GRAFT_CODE_BASELINE_NOTE).toContain('/guide')
  })

  test('help lists core slash commands', () => {
    const text = formatClaudeCodeHelp()
    expect(text).toContain('Graft')
    expect(text).toContain('/plan')
    expect(text).toContain('/mcp')
    expect(text).not.toContain('Graft (baseline')
  })
})
