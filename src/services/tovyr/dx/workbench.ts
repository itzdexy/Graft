/** The surfaces that can temporarily take focus away from the transcript. */
export type WorkbenchFocus =
  | 'none'
  | 'permission'
  | 'plan'
  | 'diff'
  | 'file'
  | 'tool'
  | 'agents'
  | 'memory'

export type WorkbenchInput = {
  /** Available terminal width in columns. */
  columns: number
  /** Available terminal height in rows. */
  rows: number
  /** The surface requested by the current turn or keyboard navigation. */
  requestedFocus: WorkbenchFocus
  /** Pending permissions always take precedence over a requested surface. */
  approvalPending: boolean
}

export type WorkbenchDensity = 'compact' | 'normal' | 'wide'
export type WorkbenchPanel = 'none' | 'overlay' | 'side'

export type WorkbenchView = {
  density: WorkbenchDensity
  panel: WorkbenchPanel
  focus: WorkbenchFocus
  showHeader: boolean
}

/**
 * Derive the responsive workbench projection from terminal and turn state.
 *
 * This intentionally has no terminal, React, or filesystem dependencies so
 * every shell consumer can share exactly the same breakpoint and focus rules.
 */
export function deriveWorkbenchView(input: WorkbenchInput): WorkbenchView {
  const focus: WorkbenchFocus = input.approvalPending ? 'permission' : input.requestedFocus
  const density: WorkbenchDensity = input.columns < 60 ? 'compact' : input.columns < 120 ? 'normal' : 'wide'

  return {
    density,
    focus,
    panel: focus === 'none' ? 'none' : density === 'wide' ? 'side' : 'overlay',
    showHeader: input.rows >= 16,
  }
}
