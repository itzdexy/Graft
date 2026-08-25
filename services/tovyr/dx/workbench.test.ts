import { describe, expect, test } from 'bun:test'

import { deriveWorkbenchView } from './workbench.js'

describe('deriveWorkbenchView', () => {
  test('narrow terminals never reserve a side panel', () => {
    expect(deriveWorkbenchView({ columns: 59, rows: 30, requestedFocus: 'plan', approvalPending: false }).panel).toBe('overlay')
  })

  test('approval overrides requested focus', () => {
    expect(deriveWorkbenchView({ columns: 140, rows: 40, requestedFocus: 'diff', approvalPending: true }).focus).toBe('permission')
  })

  test('uses the three density breakpoints', () => {
    expect(deriveWorkbenchView({ columns: 59, rows: 20, requestedFocus: 'none', approvalPending: false }).density).toBe('compact')
    expect(deriveWorkbenchView({ columns: 60, rows: 20, requestedFocus: 'none', approvalPending: false }).density).toBe('normal')
    expect(deriveWorkbenchView({ columns: 120, rows: 20, requestedFocus: 'none', approvalPending: false }).density).toBe('wide')
  })

  test('does not open a panel when there is no focus', () => {
    expect(deriveWorkbenchView({ columns: 140, rows: 40, requestedFocus: 'none', approvalPending: false })).toEqual({
      density: 'wide',
      panel: 'none',
      focus: 'none',
      showHeader: true,
    })
  })

  test('hides optional header in short terminals', () => {
    expect(deriveWorkbenchView({ columns: 140, rows: 15, requestedFocus: 'file', approvalPending: false }).showHeader).toBe(false)
    expect(deriveWorkbenchView({ columns: 140, rows: 16, requestedFocus: 'file', approvalPending: false }).showHeader).toBe(true)
  })
})
