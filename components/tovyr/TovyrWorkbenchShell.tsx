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

type Props = {
  input: WorkbenchInput
  context?: TovyrWorkbenchContext
  transcript: ReactNode
  composer: ReactNode
  focus?: ReactNode
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
}: Props): ReactNode {
  const view = deriveWorkbenchView(input)
  const focusSurface =
    view.panel !== 'none' && focus && view.focus !== 'none' ? (
      <TovyrFocusSurface focus={view.focus} placement={view.panel}>
        {focus}
      </TovyrFocusSurface>
    ) : null

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {view.showHeader && context ? <TovyrContextRail {...context} /> : null}
      <Box flexDirection="row" flexGrow={1} width="100%" overflow="hidden">
        <Box flexDirection="column" flexGrow={1} minWidth={0}>
          {transcript}
        </Box>
        {view.panel === 'side' ? focusSurface : null}
      </Box>
      {view.panel === 'overlay' ? focusSurface : null}
      {composer}
    </Box>
  )
}
