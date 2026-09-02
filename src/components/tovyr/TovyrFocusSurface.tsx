import * as React from 'react'
import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import type { WorkbenchFocus } from '../../services/tovyr/dx/workbench.js'
import { getCwd } from '../../utils/cwd.js'
import { TovyrFileSidebar } from './TovyrFileSidebar.js'

type Props = {
  focus: Exclude<WorkbenchFocus, 'none'>
  placement: 'overlay' | 'side'
  children: ReactNode
  fileRoot?: string
  fileTaskQuery?: string
}

/** A labelled evidence surface whose placement is decided by the shell. */
export function TovyrFocusSurface({
  focus,
  placement,
  children,
  fileRoot,
  fileTaskQuery,
}: Props): ReactNode {
  return (
    <Box
      flexDirection="column"
      width={placement === 'side' ? 36 : '100%'}
      flexShrink={placement === 'side' ? 0 : undefined}
      paddingX={placement === 'side' ? 1 : 0}
    >
      {placement === 'side' ? (
        <Text color="subtle" dimColor>
          │ {focus}
        </Text>
      ) : (
        <Text color="subtle" dimColor>
          {focus}
        </Text>
      )}
      {focus === 'file' ? (
        <TovyrFileSidebar
          root={fileRoot ?? getCwd()}
          taskQuery={fileTaskQuery}
        />
      ) : null}
      {children}
    </Box>
  )
}
