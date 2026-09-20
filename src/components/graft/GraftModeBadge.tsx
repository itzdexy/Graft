import { useSyncExternalStore, type ReactNode } from 'react'
import { subscribeCwdState } from '../../bootstrap/state.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text } from '../../ink.js'
import { openCodeModeLabel } from '../../services/graft/dx/activityDisplay.js'
import {
  isCrushModeEnabled,
  subscribeCrushState,
} from '../../services/graft/ecosystem/crush/state.js'
import {
  getProviderConnectionSnapshot,
  subscribeProviderConnection,
} from '../../services/graft/providers/connectionStore.js'
import { describeConnectionStatus } from './connectionStatusText.js'
import type { ProviderConnectionState } from '../../services/graft/providers/types.js'
import {
  isSuperthinkEnabled,
  subscribeSuperthinkState,
} from '../../services/graft/superthink/state.js'
import type { ToolPermissionContext } from '../../Tool.js'
import type { PromptInputMode } from '../../types/textInputTypes.js'
import { getCwd } from '../../utils/cwd.js'
import { truncateToWidth } from '../../utils/format.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'

function subscribeGraftModeFooter(listener: () => void): () => void {
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

function graftModeFooterSnapshot(): string {
  const cwd = getCwd()
  const connection = getProviderConnectionSnapshot()
  return `${cwd}\0${isSuperthinkEnabled(cwd)}\0${isCrushModeEnabled(cwd)}\0${connection.state}\0${connection.providerId}\0${connection.modelId}\0${connection.detail ?? ''}\0${connection.errorKind ?? ''}`
}

type Props = {
  toolPermissionContext: ToolPermissionContext
  mode: PromptInputMode
  onToggleModelSelector?: () => void
}

/** Quiet active mode, with actionable connection errors when necessary. */
export function GraftModeBadge({
  toolPermissionContext,
  mode,
  onToggleModelSelector,
}: Props): ReactNode {
  useSyncExternalStore(
    subscribeGraftModeFooter,
    graftModeFooterSnapshot,
    () => '\0false\0false',
  )
  const model = useMainLoopModel()
  const { columns } = useTerminalSize()

  const cwd = getCwd()
  const modeLabel = isSuperthinkEnabled(cwd)
    ? 'superthink'
    : isCrushModeEnabled(cwd)
      ? 'crush'
      : openCodeModeLabel(toolPermissionContext.mode, mode)
  const connection = getProviderConnectionSnapshot()
  const connectionState: ProviderConnectionState =
    connection.modelId && connection.modelId !== model
      ? 'checking'
      : connection.state
  if (!isGraftRuntime()) return null

  // Name what is wrong and how to recover — a bare dot never explains
  // whether the OS is offline, the provider is unreachable, or the key is
  // bad. While the connection is unhealthy the model id is uncertain, so
  // the status replaces it instead of repeating a possibly stale value.
  const statusText = describeConnectionStatus(connectionState, {
    providerId: connection.providerId,
    providerLabel: connection.providerLabel,
    detail: connection.detail,
  })
  return (
    <Box onClick={onToggleModelSelector} height={1} flexShrink={1} overflow="hidden">
      {statusText && connectionState !== 'checking' ? (
        <Text dimColor wrap="truncate-end">
          {truncateToWidth(statusText, Math.max(12, columns - modeLabel.length - 8))}{'  ·  '}
        </Text>
      ) : null}
      <Text dimColor>{modeLabel.toLowerCase()}</Text>
    </Box>
  )
}
