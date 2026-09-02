import { useMemo } from 'react'
import { Box, Text } from '../../ink.js'
import { loadAgentSession } from '../../services/tovyr/agent/persistence.js'
import { computeTovyrHud } from '../../services/tovyr/dx/agentStatus.js'
import type { Message } from '../../types/message.js'
import { getCwd } from '../../utils/cwd.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import type { Theme } from '../../utils/theme.js'

type Props = {
  messages: Message[]
  isLoading?: boolean
}

/** OpenCode-style single-line agent HUD + status indicator (Tovyr runtime only). */
export function TovyrStatusBar({
  messages,
  isLoading = false,
}: Props): React.ReactNode {
  const data = useMemo(() => {
    if (!isTovyrRuntime()) return null

    const session = loadAgentSession(getCwd())
    const hudLine = computeTovyrHud(session, messages)

    if (!hudLine) return null
    return { hudLine }
  }, [messages, isLoading])

  if (!data) return null

  return (
    <Box flexDirection="row" flexWrap="wrap" gap={1}>
      {data.hudLine ? (
        <>
          <Text color={isLoading ? 'warning' : 'success'} bold>
            {isLoading ? '!' : '*'}
          </Text>
          <Text color="tovyrPrimary" dimColor={isLoading}>
            {data.hudLine}
          </Text>
        </>
      ) : null}
    </Box>
  )
}
