import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'

type Props = {
  children: ReactNode
  addMargin?: boolean
  /** Nested sub-tool row uses a lighter branch marker. */
  nested?: boolean
}

/** Compact indented activity row for assistant/tool transcript details. */
export function GraftTreeRow({
  children,
  addMargin = false,
  nested = false,
}: Props): ReactNode {
  return (
    <Box
      flexDirection="row"
      width="100%"
      marginTop={addMargin ? 1 : 0}
      paddingX={1}
      paddingLeft={nested ? 4 : 2}
    >
      <Text color="subtle" dimColor>
        {nested ? '  > ' : '> '}
      </Text>
      <Box flexGrow={1}>{children}</Box>
    </Box>
  )
}
