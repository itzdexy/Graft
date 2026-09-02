import * as React from 'react'
import { Box } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { LAYOUT } from './spacing.js'

type Props = {
  children: React.ReactNode
  maxWidth?: number
  minWidth?: number
  paddingX?: number
}

/**
 * Horizontally centered container that caps width and adds safe side margins.
 * Width is clamped between `minWidth` and `maxWidth` and never exceeds the
 * terminal width minus horizontal padding.
 */
export function Centered({
  children,
  maxWidth = LAYOUT.composerMaxWidth,
  minWidth = LAYOUT.composerMinWidth,
  paddingX = 2,
}: Props): React.ReactNode {
  const { columns } = useTerminalSize()
  const width = Math.max(minWidth, Math.min(maxWidth, columns - paddingX * 2))
  const marginLeft = Math.max(0, Math.floor((columns - width) / 2))

  return (
    <Box flexDirection="column" width={columns}>
      <Box marginLeft={marginLeft} width={width}>
        {children}
      </Box>
    </Box>
  )
}
