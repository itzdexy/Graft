import { describe, expect, test } from 'bun:test'
import {
  formatCodexApprovalLabel,
  parseCodexPlanDisplay,
} from './codexPlanDisplay.js'

describe('parseCodexPlanDisplay', () => {
  test('parses checkbox tasks and marks first open as active', () => {
    const plan = `
# My plan
Map the workspace first.

- [ ] Inventory layout
- [x] Read README
- [ ] Trace entrypoints
`
    const parsed = parseCodexPlanDisplay(plan)
    expect(parsed.title).toBe('My plan')
    expect(parsed.summary).toContain('Map the workspace')
    expect(parsed.items).toHaveLength(3)
    expect(parsed.items[0]!.active).toBe(true)
    expect(parsed.items[1]!.done).toBe(true)
  })
})

describe('formatCodexApprovalLabel', () => {
  test('maps yes/no to Codex verbs', () => {
    expect(formatCodexApprovalLabel('Yes, auto-accept edits')).toBe('Approve')
    expect(formatCodexApprovalLabel('No, keep planning')).toBe('Request changes')
  })
})
