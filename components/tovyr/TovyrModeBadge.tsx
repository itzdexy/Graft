import figures from 'figures'
import { useSyncExternalStore, type ReactNode } from 'react'
import { subscribeCwdState } from '../../bootstrap/state.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text } from '../../ink.js'
import { openCodeModeLabel } from '../../services/tovyr/dx/activityDisplay.js'
import {
  isCrushModeEnabled,
  subscribeCrushState,
} from '../../services/tovyr/ecosystem/crush/state.js'
import {
  getProviderConnectionSnapshot,
  subscribeProviderConnection,
} from '../../services/tovyr/providers/connectionStore.js'
import type { ProviderConnectionState } from '../../services/tovyr/providers/types.js'
import {
  isSuperthinkEnabled,
  subscribeSuperthinkState,
} from '../../services/tovyr/superthink/state.js'
import { isTovyrModeMinimal } from '../../services/tovyr/terminalLayout.js'
import type { ToolPermissionContext } from '../../Tool.js'
import type { PromptInputMode } from '../../types/textInputTypes.js'
import { getCwd } from '../../utils/cwd.js'
import { renderModelName } from '../../utils/model/model.js'
import { truncateToWidth } from '../../utils/format.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'

function subscribeTovyrModeFooter(listener: () => void): () => void {
  const unsubSuperthink = subscribeSuperthinkState(listener)
  const unsubCrush = subscribeCrushState(listener)
  const unsubCwd = subscribeCwdState(listener)
  const unsubProvider = subscribeProviderConnection(listener)
  return () => {
    unsubSuperthink()
    unsubCrush()
    unsubCwd()
    unsubProvider()
  }
}

function tovyrModeFooterSnapshot(): string {
  const cwd = getCwd()
  const connection = getProviderConnectionSnapshot()
  return `${cwd}\0${isSuperthinkEnabled(cwd)}\0${isCrushModeEnabled(cwd)}\0${connection.state}\0${connection.providerId}\0${connection.modelId}`
}

type Props = {
  toolPermissionContext: ToolPermissionContext
  mode: PromptInputMode
  onToggleModelSelector?: () => void
}

/** Compact center-footer identity: connection, active mode, and routed model. */
export function TovyrModeBadge({
  toolPermissionContext,
  mode,
  onToggleModelSelector,
}: Props): ReactNode {
  useSyncExternalStore(
    subscribeTovyrModeFooter,
    tovyrModeFooterSnapshot,
    () => '\0false\0false',
  )
  const model = useMainLoopModel()
  const { columns } = useTerminalSize()
  const isMinimal = isTovyrModeMinimal(columns)

  const cwd = getCwd()
  const modeLabel = isSuperthinkEnabled(cwd)
    ? 'superthink'
    : isCrushModeEnabled(cwd)
      ? 'crush'
      : openCodeModeLabel(toolPermissionContext.mode, mode)
  const modelLabel = renderModelName(model)
  // Long provider ids ("nvidia/nemotron-3.5-lightning-30b-a3b") used to wrap
  // this badge onto a second line, which then collided with the keyboard rail
  // beneath it. The badge must stay exactly one row tall.
  const maxModelWidth = Math.max(10, Math.floor(columns * 0.4))
  const connection = getProviderConnectionSnapshot()
  const connectionState: ProviderConnectionState =
    connection.modelId && connection.modelId !== model
      ? 'checking'
      : connection.state
  const connectionGlyph: Record<ProviderConnectionState, string> = {
    unconfigured: figures.circle,
    checking: figures.ellipsis,
    ready: figures.bullet,
    limited: figures.warning,
    degraded: figures.warning,
    invalid: figures.cross,
    offline: figures.cross,
  }
  const connectionColor: Record<
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

  if (!isTovyrRuntime()) return null

  return (
      <Box onClick={onToggleModelSelector} height={1} flexShrink={0} overflow="hidden">
        <Text color={connectionColor[connectionState]}>
          {connectionGlyph[connectionState]}{' '}
        </Text>
        <Text color="tovyrPrimary" bold>
          {modeLabel}
        </Text>
        {!isMinimal && modelLabel ? (
          <Text color="subtle" wrap="truncate-end">
            {'  ·  '}
            <Text color="text">
              {truncateToWidth(modelLabel, maxModelWidth)}
            </Text>
          </Text>
        ) : null}
        {!isMinimal ? (
          <Text color="subtle" dimColor>
            {'  ▾'}
          </Text>
        ) : null}
      </Box>
  )
}
