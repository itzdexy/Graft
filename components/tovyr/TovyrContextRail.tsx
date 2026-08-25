import * as React from 'react'
import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'

export type TovyrWorkbenchContext = {
  project?: string
  branch?: string
  dirty?: boolean
  provider?: string
  model?: string
  session?: string
  connection?: string
}

type Props = TovyrWorkbenchContext

/**
 * A single, compact context line for the workbench. It deliberately has no
 * independent state: REPL remains the owner of project and provider facts.
 */
export function TovyrContextRail({
  project,
  branch,
  dirty,
  provider,
  model,
  session,
  connection,
}: Props): ReactNode {
  const facts = [
    project,
    branch ? `${branch}${dirty ? '*' : ''}` : undefined,
    provider && model ? `${provider} · ${model}` : provider ?? model,
    session,
    connection,
  ].filter((fact): fact is string => Boolean(fact))

  if (facts.length === 0) return null

  return (
    <Box width="100%" paddingX={1} flexShrink={0}>
      <Text wrap="truncate-end">
        <Text color="tovyrPrimary" bold>
          Tovyr
        </Text>
        <Text color="subtle" dimColor>
          {' · '}
          {facts.join(' · ')}
        </Text>
      </Text>
    </Box>
  )
}
