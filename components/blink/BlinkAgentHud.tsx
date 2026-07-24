import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Box, Text, useAnimationFrame } from '../../ink.js'
import { loadAgentSession } from '../../services/blink/agent/persistence.js'
import { computeBlinkHud } from '../../services/blink/dx/agentStatus.js'
import type { Message } from '../../types/message.js'
import { getCwd } from '../../utils/cwd.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { useSettings } from '../../hooks/useSettings.js'
import { SpinnerGlyph } from '../Spinner/SpinnerGlyph.js'

type Props = {
  messages: Message[]
  isLoading?: boolean
}

const AGENT_FRAMES = ['\u25CB', '\u25D4', '\u25CF', '\u25D0'];

/** OpenCode-style agent status HUD (Blink runtime only). */
export function BlinkAgentHud({ messages, isLoading = false }: Props): ReactNode {
  const reducedMotion = useSettings().prefersReducedMotion ?? false
  const [, time] = useAnimationFrame(reducedMotion ? null : 100)
  const frame = reducedMotion ? 0 : Math.floor(time / 200) % AGENT_FRAMES.length

  const hud = useMemo(() => {
    if (!isBlinkRuntime()) return null
    const session = loadAgentSession(getCwd())
    const line = computeBlinkHud(session, messages)
    if (!line) return null
    return { line, session }
  }, [messages, isLoading])

  if (!hud) return null

  return (
    <Box flexDirection="row" gap={1}>
      {isLoading ? (
        <Text color="blinkPrimary" bold>
          {AGENT_FRAMES[frame]}
        </Text>
      ) : (
        <Text color="success" bold>
          *
        </Text>
      )}
      <Text color={isLoading ? 'blinkPrimary' : 'text'} dimColor={isLoading} bold={isLoading}>
        {hud.line}
      </Text>
    </Box>
  )
}
