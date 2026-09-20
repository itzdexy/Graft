import * as React from 'react'
import type { ReactNode } from 'react'
import { Box } from '../../ink.js'
import {
  deriveWorkbenchView,
  type WorkbenchFocus,
  type WorkbenchInput,
} from '../../services/graft/dx/workbench.js'
import {
  GraftContextRail,
  shouldShowGraftContextAgentStatus,
  type GraftWorkbenchContext,
} from './GraftContextRail.js'
import { GraftFocusSurface } from './GraftFocusSurface.js'

type Props = {
  input: WorkbenchInput
  context?: GraftWorkbenchContext
  transcript: ReactNode
  composer: ReactNode
  focus?: ReactNode
  fileRoot?: string
  fileTaskQuery?: string
  isTranscriptEmpty?: boolean
}

export type GraftEmptyTranscriptInput = {
  messageCount: number
  pendingUserText: string
  isLoading: boolean
  isProcessing: boolean
  activeToolCount: number
}

/** Empty guidance belongs only to a transcript with no pending or active turn. */
export function shouldShowGraftEmptyTranscript(
  input: GraftEmptyTranscriptInput,
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
 * Responsive Graft-only composition. The shell owns layout only; transcript,
 * focus, and composer state stay with the REPL so resizing cannot discard
 * input, selections, or pending approvals.
 */
export function GraftWorkbenchShell({
  input,
  context,
  transcript,
  composer,
  focus,
  fileRoot,
  fileTaskQuery,
}: Props): ReactNode {
  const view = deriveWorkbenchView(input)
  const approvalPending = view.focus === 'permission'
  const focusSurface =
    view.panel !== 'none' && (focus || view.focus === 'file') && view.focus !== 'none' ? (
      <GraftFocusSurface
        focus={view.focus}
        placement={approvalPending ? 'overlay' : view.panel}
        fileRoot={fileRoot}
        fileTaskQuery={fileTaskQuery}
      >
        {focus}
      </GraftFocusSurface>
    ) : null
  // Approvals contain the command/diff and decision controls. They must never
  // inherit the deliberately narrow evidence rail used by plans and diffs.

  return (
    <Box flexDirection="column" width="100%" flexShrink={0} gap={1}>
      {view.showHeader && context ? (
        <GraftContextRail
          {...context}
          showAgentStatus={shouldShowGraftContextAgentStatus(view.focus)}
        />
      ) : null}
      <Box flexDirection="row" width="100%" flexShrink={0}>
        <Box
          flexDirection="column"
          flexGrow={1}
          flexShrink={1}
          minWidth={0}
        >
          <Box flexDirection="column" flexShrink={0} paddingBottom={1}>
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
