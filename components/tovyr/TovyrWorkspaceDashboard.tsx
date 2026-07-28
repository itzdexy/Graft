import { useSyncExternalStore, type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { TovyrBuddy } from '../LogoV2/TovyrBuddy.js'
import {
  getProviderConnectionSnapshot,
  subscribeProviderConnection,
} from '../../services/tovyr/providers/connectionStore.js'
import type { ProviderConnectionState } from '../../services/tovyr/providers/types.js'
import { resolveActive } from '../../scripts/tovyr-providers.js'

type Props = {
  version: string
  cwd: string
  model: string
  provider?: string
  agent?: string
}

const ACTIONS = [
  { command: '/code', description: 'Build, edit, and run the project' },
  { command: '/plan', description: 'Design the approach before changes' },
  { command: '/model', description: 'Choose a model for this provider' },
  { command: '/provider', description: 'Connect or switch providers' },
  { command: '/config', description: 'Configure tool rules and options' },
  { command: '/init', description: 'Initialize TOVYR context for workspace' },
]

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

function fit(value: string, width: number): string {
  if (value.length <= width) return value
  return width <= 3 ? value.slice(0, width) : `${value.slice(0, width - 3)}...`
}

function IdentityPanel({
  width,
  model,
  provider,
  cwd,
  agent,
}: {
  width: number
  model: string
  provider?: string
  cwd: string
  agent?: string
}): ReactNode {
  const textWidth = Math.max(14, width - 2)
  return (
    <Box
      flexDirection="column"
      width={width}
      alignItems="center"
      paddingX={1}
    >
      <Text bold color="cyan">Welcome to TOVYR</Text>
      <Box marginY={1}>
        <TovyrBuddy pose="default" />
      </Box>
      <Text color="cyan" bold wrap="truncate-end">
        {fit(model, textWidth)}
      </Text>
      <Text color="subtle" dimColor wrap="truncate-end">
        {fit(provider || 'Provider connected', textWidth)}
        {' / '}
        {fit(agent || 'tovyr-agent', 12)}
      </Text>
      <Text color="subtle" dimColor wrap="truncate-end">
        {fit(cwd, textWidth)}
      </Text>
    </Box>
  )
}

function ActionPanel({
  width,
  model,
  provider,
  connectionState,
}: {
  width: number
  model: string
  provider?: string
  connectionState: ProviderConnectionState
}): ReactNode {
  const connectionLabel: Record<ProviderConnectionState, string> = {
    unconfigured: 'Not connected',
    checking: 'Checking',
    ready: 'Ready',
    limited: 'Limited',
    degraded: 'Degraded',
    invalid: 'Invalid',
    offline: 'Offline',
  }
  const connectionColor: Record<
    ProviderConnectionState,
    'success' | 'warning' | 'error' | 'subtle' | 'cyan'
  > = {
    unconfigured: 'subtle',
    checking: 'cyan',
    ready: 'success',
    limited: 'warning',
    degraded: 'warning',
    invalid: 'error',
    offline: 'error',
  }
  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      <Text color="cyan" bold>
        Quick Commands
      </Text>
      {ACTIONS.map(action => (
        <Box key={action.command}>
          <Box width={12}>
            <Text color="cyan" bold>
              {action.command}
            </Text>
          </Box>
          <Text color="subtle" dimColor wrap="truncate-end">
            {action.description}
          </Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color="cyan" dimColor>
          {'-'.repeat(Math.max(12, width - 2))}
        </Text>
      </Box>

      <Text color="cyan" bold>
        Active Connection
      </Text>
      <Text wrap="truncate-end">
        <Text color="subtle" dimColor>
          Status{'   '}
        </Text>
        <Text color={connectionColor[connectionState]} bold>
          {connectionLabel[connectionState]}
        </Text>
      </Text>
      <Text wrap="truncate-end">
        <Text color="subtle" dimColor>
          Provider{' '}
        </Text>
        {provider || 'FreeModel'}
      </Text>
      <Text wrap="truncate-end">
        <Text color="subtle" dimColor>
          Model{'    '}
        </Text>
        {model}
      </Text>
    </Box>
  )
}

/**
 * TOVYR v1 welcome card: sleek terminal dashboard layout with TOVYR-owned
 * branding, provider routing, model state, and quick commands.
 */
export function TovyrWorkspaceDashboard({
  version,
  cwd,
  model,
  agent,
}: Props): ReactNode {
  const connection = useSyncExternalStore(
    subscribeProviderConnection,
    getProviderConnectionSnapshot,
    getProviderConnectionSnapshot,
  )
  const display = resolveDashboardConnection({
    fallbackModel: model,
    connection,
    active: resolveActive(),
  })
  const { columns } = useTerminalSize()
  const width = Math.max(30, Math.min(96, columns - 4))
  const horizontal = width >= 70
  const leftWidth = horizontal ? Math.min(30, Math.floor(width * 0.35)) : width - 2
  const rightWidth = horizontal ? width - leftWidth - 3 : width - 2

  return (
    <Box
      width={width}
      marginLeft={2}
      marginTop={1}
      marginBottom={1}
      borderStyle="round"
      borderColor="cyan"
      borderText={{
        content: ` TOVYR v${version} `,
        position: 'top',
        align: 'start',
        offset: 2,
      }}
      flexDirection={horizontal ? 'row' : 'column'}
      paddingY={1}
    >
      <IdentityPanel
        width={leftWidth}
        model={display.model}
        provider={display.provider}
        cwd={cwd}
        agent={agent}
      />

      {horizontal ? (
        <Box
          width={1}
          marginX={1}
          borderStyle="single"
          borderLeft
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderColor="cyan"
        />
      ) : (
        <Box paddingX={1} marginY={1}>
          <Text color="cyan" dimColor>
            {'-'.repeat(Math.max(12, width - 4))}
          </Text>
        </Box>
      )}

      <ActionPanel
        width={rightWidth}
        model={display.model}
        provider={display.provider}
        connectionState={display.state}
      />
    </Box>
  )
}
