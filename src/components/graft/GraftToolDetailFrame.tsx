import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'

/** Transparent terminal-native disclosure rail; deliberately not a card. */
export function GraftToolDetailFrame({
  children,
  error = false,
}: {
  children: ReactNode
  error?: boolean
}): ReactNode {
  return (
    <Box flexDirection="row" paddingLeft={2} width="100%">
      <Text color={error ? 'error' : 'subtle'} dimColor>
        {'| '}
      </Text>
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
    </Box>
  )
}
