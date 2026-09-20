import { basename } from 'path'
import { useState, type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import type { ProviderConnectionState } from '../../services/graft/providers/types.js'
import type { resolveActive } from '../../../scripts/graft-providers.js'
import { GraftBuddy } from '../LogoV2/GraftBuddy.js'

type Props = {
  version?: string
  cwd: string
  model: string
  provider?: string
  agent?: string
  compact?: boolean
  date?: Date
}

export function resolveDashboardConnection({
  fallbackModel,
  connection,
  active,
}: {
  fallbackModel: string
  connection: {
    state: ProviderConnectionState
    providerId: string
    providerLabel: string
    modelId: string
  }
  active: ReturnType<typeof resolveActive>
}): {
  provider?: string
  model: string
  state: ProviderConnectionState
} {
  if (!active) {
    return {
      provider: undefined,
      model: fallbackModel,
      state: 'unconfigured',
    }
  }

  const snapshotMatchesActive =
    connection.providerId === active.providerId &&
    connection.modelId === active.model
  return {
    provider: active.label,
    model: active.model || fallbackModel,
    state: snapshotMatchesActive ? connection.state : 'checking',
  }
}


/** One quiet identity block. No idle animation or duplicate operational metadata. */
export function GraftWorkspaceDashboard({
  cwd,
  model,
  compact = false,
  date,
}: Props): ReactNode {
  const { columns } = useTerminalSize()
  const [openedAt] = useState(() => new Date())
  const sessionDate = (date ?? openedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const small = compact || columns < 48
  return (
    <Box width="100%" flexDirection="row" gap={2} paddingY={1}>
      <GraftBuddy inline={small} />
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Text wrap="truncate-end">
          <Text bold>Graft</Text>
          <Text dimColor>{' · '}{model}</Text>
        </Text>
        <Text dimColor wrap="truncate-end">{sessionDate}</Text>
        <Text dimColor wrap="truncate-end">{basename(cwd) || cwd}</Text>
      </Box>
    </Box>
  )
}
