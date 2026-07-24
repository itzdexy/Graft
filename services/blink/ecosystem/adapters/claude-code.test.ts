import { describe, expect, test } from 'bun:test'
import {
  CLAUDE_CODE_BASELINE_NOTE,
  formatClaudeCodeHelp,
} from './claude-code.js'

describe('claude-code adapter', () => {
  test('baseline note uses Blink branding', () => {
    expect(CLAUDE_CODE_BASELINE_NOTE).toContain('Blink')
    expect(CLAUDE_CODE_BASELINE_NOTE).toContain('/guide')
  })

  test('help lists core slash commands', () => {
    const text = formatClaudeCodeHelp()
    expect(text).toContain('Blink')
    expect(text).toContain('/plan')
    expect(text).toContain('/mcp')
    expect(text).not.toContain('Claude Code (baseline')
  })
})
