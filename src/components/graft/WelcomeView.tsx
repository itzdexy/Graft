import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { ResponsiveLayout } from '../design-system/ResponsiveLayout.js'
import { SPACING } from '../design-system/spacing.js'
import { GraftWordmark } from './GraftWordmark.js'
import { ActivityClawd } from '../LogoV2/ActivityClawd.js'

type Props = {
  isWorking?: boolean
  mode?: string
  model?: string
  thinking?: string
  agent?: string
  contextPercent?: number
  placeholder?: string
  tip?: string
}

const DEFAULT_TIPS = [
  'Use /plan before making large changes.',
  'Press Ctrl+P to search commands.',
  'Use /model to switch providers.',
  'Type @ to reference a file.',
  'Press Tab to switch agents.',
]

/** Stable tip index derived from the calendar day so it rotates daily. */
function getTipIndex(): number {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  return day % DEFAULT_TIPS.length
}

/**
 * Calm, centered startup screen. Shows a minimal wordmark, a centered composer
 * frame, the most useful shortcuts, and one rotating tip.
 */
export function WelcomeView({
  isWorking = false,
  mode = 'Ask',
  model = 'z-ai/glm-5.2',
  thinking,
  agent,
  contextPercent,
  placeholder = 'Ask Graft anything…',
  tip = DEFAULT_TIPS[getTipIndex()],
}: Props): React.ReactNode {
  const { rows } = useTerminalSize()
  const topPadding = Math.max(1, Math.floor((rows - 17) / 3))

  return (
    <Box flexDirection="column" width="100%" paddingTop={topPadding}>
      <Box
        flexDirection="column"
        alignItems="center"
        marginBottom={SPACING.sm}
      >
        <ActivityClawd mood={isWorking ? 'talking' : 'idle'} />
      </Box>
      <GraftWordmark />

      <Box
        flexDirection="row"
        justifyContent="center"
        gap={SPACING.md}
        marginBottom={SPACING.sm}
      >
        <Text color="subtle" dimColor>
          <Text color="graftPrimary" bold>Tab</Text> agents
        </Text>
        <Text color="subtle" dimColor>
          <Text color="graftPrimary" bold>Ctrl+P</Text> commands
        </Text>
      </Box>

      <ResponsiveLayout hideBelowRows={14}>
        <Box flexDirection="row" justifyContent="center">
          <Text color="subtle" dimColor>
            <Text color="warning">• Tip</Text> {tip}
          </Text>
        </Box>
      </ResponsiveLayout>
    </Box>
  )
}
