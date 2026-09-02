import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import {
  projectWebToolResult,
  type WebToolResultLike,
} from '../../services/tovyr/dx/toolResultPresentation.js'

export function TovyrWebResultMessage({
  content,
  verbose,
}: {
  content: WebToolResultLike
  verbose: boolean
}): ReactNode {
  const result = projectWebToolResult(content)
  if (verbose) {
    return (
      <Box flexDirection="column">
        <Text color="text">{result.summary}</Text>
        <Text color="subtle" wrap="wrap">{result.detail}</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row">
        <Text color="subtle" dimColor>{'| '}</Text>
        <Text color="text" dimColor>{result.summary}</Text>
      </Box>
    </Box>
  )
}
