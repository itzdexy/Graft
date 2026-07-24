import { useMemo } from 'react'
import { Box, Text } from '../../ink.js'
import { loadAgentSession } from '../../services/blink/agent/persistence.js'
import { computeBlinkHud } from '../../services/blink/dx/agentStatus.js'
import type { Message } from '../../types/message.js'
import { getCwd } from '../../utils/cwd.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import type { Theme } from '../../utils/theme.js'

type Props = {
  messages: Message[]
  isLoading?: boolean
}

/** OpenCode-style single-line agent HUD + status indicator (Blink runtime only). */
export function BlinkStatusBar({
  messages,
  isLoading = false,
}: Props): React.ReactNode {
  const data = useMemo(() => {
    if (!isBlinkRuntime()) return null

    const session = loadAgentSession(getCwd())
    const hudLine = computeBlinkHud(session, messages)

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
          <Text color="blinkPrimary" dimColor={isLoading}>
            {data.hudLine}
          </Text>
        </>
      ) : null}
    </Box>
  )
}
