import * as React from 'react'
import type { ReactNode } from 'react'
import { Box } from '../../ink.js'
import {
  deriveWorkbenchView,
  type WorkbenchInput,
} from '../../services/tovyr/dx/workbench.js'
import {
  TovyrContextRail,
  type TovyrWorkbenchContext,
} from './TovyrContextRail.js'
import { TovyrFocusSurface } from './TovyrFocusSurface.js'
import { TovyrEmptyState } from './TovyrEmptyState.js'

type Props = {
  input: WorkbenchInput
  context?: TovyrWorkbenchContext
  transcript: ReactNode
  composer: ReactNode
  focus?: ReactNode
  isTranscriptEmpty?: boolean
}

/**
 * Responsive Tovyr-only composition. The shell owns layout only; transcript,
 * focus, and composer state stay with the REPL so resizing cannot discard
 * input, selections, or pending approvals.
 */
export function TovyrWorkbenchShell({
  input,
  context,
  transcript,
  composer,
  focus,
  isTranscriptEmpty = false,
}: Props): ReactNode {
  const view = deriveWorkbenchView(input)
  const approvalPending = view.focus === 'permission'
  const focusSurface =
    view.panel !== 'none' && focus && view.focus !== 'none' ? (
      <TovyrFocusSurface
        focus={view.focus}
        placement={approvalPending ? 'overlay' : view.panel}
      >
        {focus}
      </TovyrFocusSurface>
    ) : null
  // Approvals contain the command/diff and decision controls. They must never
  // inherit the deliberately narrow evidence rail used by plans and diffs.

  return (
    <Box flexDirection="column" width="100%" flexShrink={0}>
      {view.showHeader && context ? <TovyrContextRail {...context} /> : null}
      <Box flexDirection="row" width="100%" flexShrink={0}>
        <Box
          flexDirection="column"
          flexGrow={1}
          flexShrink={1}
          minWidth={0}
        >
          <Box flexDirection="column" flexShrink={0}>
            {isTranscriptEmpty ? <TovyrEmptyState compact /> : null}
            {transcript}
          </Box>
        </Box>
        {view.panel === 'side' && !approvalPending ? focusSurface : null}
      </Box>
      {view.panel === 'overlay' || approvalPending ? focusSurface : null}
      {composer}
    </Box>
  )
}
