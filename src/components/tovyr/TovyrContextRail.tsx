import * as React from 'react'
import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import type { Message } from '../../types/message.js'
import type { WorkbenchFocus } from '../../services/tovyr/dx/workbench.js'
import { TovyrCostMeter } from './TovyrCostMeter.js'
import {
  TovyrNotifications,
  type TovyrNotification,
} from './TovyrNotifications.js'
import { TovyrSessionHeader } from './TovyrSessionHeader.js'
import { TovyrStatusBar } from './TovyrStatusBar.js'
import { TovyrHeader } from './TovyrHeader.js'

export type TovyrWorkbenchContext = {
  project?: string
  branch?: string
  dirty?: boolean
  provider?: string
  model?: string
  session?: string
  connection?: string
  messages?: Message[]
  isLoading?: boolean
  refreshKey?: number
  notifications?: TovyrNotification[]
  onDismissNotification?: (id: string) => void
}

type Props = TovyrWorkbenchContext & {
  showAgentStatus?: boolean
}

/** The agents focus owns its live HUD; the context rail must not echo it. */
export function shouldShowTovyrContextAgentStatus(
  focus: WorkbenchFocus,
): boolean {
  return focus !== 'agents'
}

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
  messages = [],
  isLoading = false,
  refreshKey = 0,
  notifications = [],
  onDismissNotification = () => {},
  showAgentStatus = true,
}: Props): ReactNode {
  const facts = [
    project,
    branch ? `${branch}${dirty ? '*' : ''}` : undefined,
    provider && model ? `${provider} · ${model}` : provider ?? model,
    session,
    connection,
  ].filter((fact): fact is string => Boolean(fact))

  if (facts.length === 0 && notifications.length === 0) return null

  return (
    <Box width="100%" flexDirection="column" flexShrink={0}>
      {facts.length > 0 ? (
        <Box width="100%" paddingX={1}>
          <Box flexDirection="column" width="100%">
            <TovyrHeader />
            <Text color="subtle" dimColor wrap="truncate-end">
              {facts.join(' · ')}
            </Text>
          </Box>
        </Box>
      ) : null}
      <TovyrSessionHeader isLoading={isLoading} refreshKey={refreshKey} />
      <Box paddingX={1} flexDirection="row" gap={2} flexWrap="wrap">
        <TovyrCostMeter isLoading={isLoading} />
        {showAgentStatus ? (
          <TovyrStatusBar messages={messages} isLoading={isLoading} />
        ) : null}
      </Box>
      <TovyrNotifications
        notifications={notifications}
        onDismiss={onDismissNotification}
      />
    </Box>
  )
}
