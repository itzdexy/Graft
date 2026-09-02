import { describe, expect, test } from 'bun:test'

import { deriveWorkbenchView } from './workbench.js'

describe('deriveWorkbenchView', () => {
  test('narrow terminals never reserve a side panel', () => {
    expect(deriveWorkbenchView({ columns: 59, rows: 30, requestedFocus: 'plan', approvalPending: false }).panel).toBe('overlay')
  })

  test('approval overrides requested focus and keeps the panel placement consistent', () => {
    const wide = deriveWorkbenchView({ columns: 140, rows: 40, requestedFocus: 'diff', approvalPending: true })
    expect(wide.focus).toBe('permission')
    expect(wide.panel).toBe('side')

    const normal = deriveWorkbenchView({ columns: 119, rows: 40, requestedFocus: 'diff', approvalPending: true })
    expect(normal.focus).toBe('permission')
    expect(normal.panel).toBe('overlay')
  })

  test.each([
    [59, 'compact', 'overlay'],
    [60, 'normal', 'overlay'],
    [119, 'normal', 'overlay'],
    [120, 'wide', 'side'],
  ] as const)('maps %i columns to %s density and %s panel', (columns, density, panel) => {
    const view = deriveWorkbenchView({ columns, rows: 20, requestedFocus: 'plan', approvalPending: false })
    expect(view.density).toBe(density)
    expect(view.panel).toBe(panel)
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
