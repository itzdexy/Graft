import * as React from 'react'
import type { ReactNode } from 'react'
import { Box } from '../../ink.js'
import {
  deriveWorkbenchView,
  type WorkbenchFocus,
  type WorkbenchInput,
} from '../../services/tovyr/dx/workbench.js'
import {
  TovyrContextRail,
  shouldShowTovyrContextAgentStatus,
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

export type TovyrEmptyTranscriptInput = {
  messageCount: number
  pendingUserText: string
  isLoading: boolean
  isProcessing: boolean
  activeToolCount: number
}

/** Empty guidance belongs only to a transcript with no pending or active turn. */
export function shouldShowTovyrEmptyTranscript(
  input: TovyrEmptyTranscriptInput,
): boolean {
  return (
    input.messageCount === 0 &&
    input.pendingUserText.trim().length === 0 &&
    !input.isLoading &&
    !input.isProcessing &&
    input.activeToolCount === 0
  )
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
      {view.showHeader && context ? (
        <TovyrContextRail
          {...context}
          showAgentStatus={shouldShowTovyrContextAgentStatus(view.focus)}
        />
      ) : null}
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
