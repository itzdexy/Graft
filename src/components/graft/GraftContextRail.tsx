import * as React from 'react'
import type { ReactNode } from 'react'
import { Box } from '../../ink.js'
import type { Message } from '../../types/message.js'
import type { WorkbenchFocus } from '../../services/graft/dx/workbench.js'
import { GraftNotifications, type GraftNotification } from './GraftNotifications.js'
import { GraftWorkspaceDashboard } from './GraftWorkspaceDashboard.js'
import { getOriginalCwd } from '../../bootstrap/state.js'
import { getActiveModelId, getActiveProviderId, getProvider } from '../../../scripts/graft-providers.js'

export type GraftWorkbenchContext = {
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
  notifications?: GraftNotification[]
  onDismissNotification?: (id: string) => void
}

type Props = GraftWorkbenchContext & {
  showAgentStatus?: boolean
}

/** The agents focus owns its live HUD; the context rail must not echo it. */
export function shouldShowGraftContextAgentStatus(
  focus: WorkbenchFocus,
): boolean {
  return focus !== 'agents'
}

export function formatGraftConnectionFacts(input: {
  provider?: string
  model?: string
  effort?: string
  session?: string
  connection?: string
}): string[] {
  const identity = [input.provider, input.model, input.effort]
    .filter((fact): fact is string => Boolean(fact))
    .join(' · ')
  return [identity || undefined, input.session, input.connection].filter(
    (fact): fact is string => Boolean(fact),
  )
}


/** A single chat header; notifications remain available for actionable events. */
export function GraftContextRail({
  project,
  model,
  notifications = [],
  onDismissNotification = () => {},
}: Props): ReactNode {
  const providerId = getActiveProviderId()
  const provider = getProvider(providerId)
  const modelId = model || getActiveModelId(providerId)
  const modelLabel =
    provider?.models.find(entry => entry.id === modelId)?.label ?? modelId
  return (
    <Box width="100%" flexDirection="column" flexShrink={0} paddingX={1}>
      <GraftWorkspaceDashboard
        cwd={project || getOriginalCwd()}
        model={modelLabel}
      />
      <GraftNotifications
        notifications={notifications}
        onDismiss={onDismissNotification}
      />
    </Box>
  )
}
