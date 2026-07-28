import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'

type Props = {
  hideBelow?: number
}

/**
 * Clean two-tone Tovyr wordmark. Hidden on very narrow or short terminals to
 * keep the screen focused on the composer.
 */
export function TovyrWordmark({ hideBelow = 40 }: Props): React.ReactNode {
  const { columns, rows } = useTerminalSize()

  if (columns < hideBelow || rows < 12) {
    return null
  }

  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      <Text bold>
        <Text color="tovyrPrimary">BL</Text>
        <Text color="tovyrSecondary">INK</Text>
      </Text>
    </Box>
  )
}
