import { basename } from 'path'
import { useSyncExternalStore, type ReactNode } from 'react'
import { Box, Text, useAnimationFrame } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import {
  getProviderConnectionSnapshot,
  subscribeProviderConnection,
} from '../../services/tovyr/providers/connectionStore.js'
import type { ProviderConnectionState } from '../../services/tovyr/providers/types.js'
import { resolveActive } from '../../../scripts/tovyr-providers.js'
import { BREAKPOINTS } from '../design-system/themeTokens.js'
import { useAppStateMaybeOutsideOfProvider } from '../../state/AppState.js'
import { TovyrBuddy, type TovyrBuddyPose } from '../LogoV2/TovyrBuddy.js'

type Props = {
  version: string
  cwd: string
  model: string
  provider?: string
  agent?: string
  compact?: boolean
}

const QUICK_ACTIONS = ['/code', '/plan', '/model'] as const

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

const CONNECTION_LABEL: Record<ProviderConnectionState, string> = {
  unconfigured: 'not connected',
  checking: 'checking',
  ready: 'ready',
  limited: 'limited',
  degraded: 'degraded',
  invalid: 'invalid',
  offline: 'offline',
}

const CONNECTION_COLOR: Record<
  ProviderConnectionState,
  'success' | 'warning' | 'error' | 'subtle' | 'tovyrPrimary'
> = {
  unconfigured: 'subtle',
  checking: 'tovyrPrimary',
  ready: 'success',
  limited: 'warning',
  degraded: 'warning',
  invalid: 'error',
  offline: 'error',
}

function CompactSessionRail({
  width,
  cwd,
  provider,
  state,
}: {
  width: number
  cwd: string
  provider?: string
  state: ProviderConnectionState
}): ReactNode {
  const project = fit(basename(cwd) || cwd, Math.max(8, Math.floor(width * 0.35)))
  const connection = fit(
    `${CONNECTION_LABEL[state]} · ${provider || 'no provider'}`,
    Math.max(14, Math.floor(width * 0.46)),
  )
  const gap = Math.max(1, width - project.length - connection.length - 5)

  return (
    <Box width={width}>
      <Text wrap="truncate">
        <Text color="tovyrPrimary">◆</Text>
        <Text color="text"> {project}</Text>
        {' '.repeat(gap)}
        <Text color={CONNECTION_COLOR[state]}>●</Text>
        <Text color="subtle" dimColor>
          {' '}
          {connection}
        </Text>
      </Text>
    </Box>
  )
}

/** ~7fps: the disk turns slowly and the buddy idles slower still. */
const FRAME_MS = 140
/** Idle loop: the buddy glances around rather than staring. */
const BUDDY_IDLE: TovyrBuddyPose[] = [
  'default',
  'default',
  'look-left',
  'default',
  'default',
  'look-right',
  'default',
  'happy',
]

/**
 * Minimal opening screen: one left-aligned identity block, the buddy, and a
 * hint row.
 *
 * This replaced a three-column layout of bordered widgets over a scattered
 * "starfield" backdrop. At real terminal sizes the boxes fought each other for
 * width and the sparse backdrop glyphs read as rendering artifacts rather than
 * atmosphere, so both are gone. Nothing here is boxed, centered, or animated.
 */
export function TovyrWorkspaceDashboard({
  version,
  cwd,
  model,
  agent,
  compact = false,
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
  const { columns, rows: terminalRows } = useTerminalSize()
  const reducedMotion =
    useAppStateMaybeOutsideOfProvider(
      state => state.settings.prefersReducedMotion,
    ) ?? false
  const [frameRef, time] = useAnimationFrame(reducedMotion ? null : FRAME_MS)
  const frame = reducedMotion ? 0 : Math.floor(time / FRAME_MS)
  // The buddy idles roughly six times slower than the disk turns.
  const buddyPose = reducedMotion
    ? 'default'
    : BUDDY_IDLE[Math.floor(frame / 6) % BUDDY_IDLE.length]!
  const width = Math.max(30, Math.min(BREAKPOINTS.wide, columns - 2))
  const project = basename(cwd) || cwd

  if (compact) {
    return (
      <Box width={width} alignSelf="center" marginTop={1} marginBottom={1}>
        <CompactSessionRail
          width={width}
          cwd={cwd}
          provider={display.provider}
          state={display.state}
        />
      </Box>
    )
  }

  const inner = Math.max(20, width - 2)

  return (
    <Box
      ref={frameRef}
      width={width}
      alignSelf="center"
      flexDirection="column"
      marginTop={1}
      marginBottom={1}
      paddingX={1}
    >
      <Text wrap="truncate-end">
        <Text color="tovyrPrimary" bold>{'◆ Tovyr'}</Text>
        <Text color="subtle" dimColor>{` v${version}`}</Text>
      </Text>
      <Text wrap="truncate-end">
        <Text color="text">{fit(project, Math.floor(inner * 0.6))}</Text>
        <Text color="subtle" dimColor>{'  ·  '}</Text>
        <Text color={CONNECTION_COLOR[display.state]}>
          {CONNECTION_LABEL[display.state]}
        </Text>
      </Text>

      <Box flexDirection="row" gap={2} marginTop={1}>
        <TovyrBuddy pose={buddyPose} />
        <Box flexDirection="column" justifyContent="center">
          <Text color="subtle" dimColor wrap="truncate-end">
            {fit(
              `${display.provider || 'no provider'} · ${display.model}`,
              Math.max(20, inner - 14),
            )}
          </Text>
          {agent ? (
            <Text color="subtle" dimColor wrap="truncate-end">
              {fit(agent, Math.max(20, inner - 14))}
            </Text>
          ) : null}
          <Box marginTop={1}>
            <Text wrap="truncate-end">
              {QUICK_ACTIONS.map((command, index) => (
                <Text key={command}>
                  {index > 0 ? <Text color="subtle" dimColor>{'  '}</Text> : null}
                  <Text color="warning">{command}</Text>
                </Text>
              ))}
              <Text color="subtle" dimColor>{'     '}</Text>
              <Text color="tovyrPrimary">ctrl+p</Text>
              <Text color="subtle" dimColor>{' commands  '}</Text>
              <Text color="tovyrPrimary">?</Text>
              <Text color="subtle" dimColor>{' help'}</Text>
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
