import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Text } from '../../ink.js'
import {
  isSuperthinkEnabled,
  subscribeSuperthinkState,
} from '../../services/tovyr/superthink/state.js'
import {
  isCrushModeEnabled,
  subscribeCrushState,
} from '../../services/tovyr/ecosystem/crush/state.js'
import type { ToolPermissionContext } from '../../Tool.js'
import type { PromptInputMode } from '../../types/textInputTypes.js'
import { isTovyrModeMinimal } from '../../services/tovyr/terminalLayout.js'
import { subscribeCwdState } from '../../bootstrap/state.js'
import { getCwd } from '../../utils/cwd.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { renderModelName } from '../../utils/model/model.js'
import { openCodeModeLabel } from '../../services/tovyr/dx/activityDisplay.js'
import {
  getProviderConnectionSnapshot,
  subscribeProviderConnection,
} from '../../services/tovyr/providers/connectionStore.js'
import type { ProviderConnectionState } from '../../services/tovyr/providers/types.js'

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
}

/** Tovyr-owned footer identity: active mode and routed model. */
export function TovyrModeBadge({
  toolPermissionContext,
  mode,
}: Props): ReactNode {
  useSyncExternalStore(
    subscribeTovyrModeFooter,
    tovyrModeFooterSnapshot,
    () => '\0false\0false',
  )
  const model = useMainLoopModel()
  const { columns } = useTerminalSize()
  const isMinimal = isTovyrModeMinimal(columns)

  if (!isTovyrRuntime()) return null

  const cwd = getCwd()
  const modeLabel = isSuperthinkEnabled(cwd)
    ? 'superthink'
    : isCrushModeEnabled(cwd)
      ? 'crush'
      : openCodeModeLabel(toolPermissionContext.mode, mode)
  const modelLabel = renderModelName(model)
  const connection = getProviderConnectionSnapshot()
  const connectionState: ProviderConnectionState =
    connection.modelId && connection.modelId !== model
      ? 'checking'
      : connection.state
  const connectionGlyph: Record<ProviderConnectionState, string> = {
    unconfigured: '○',
    checking: '◌',
    ready: '●',
    limited: '!',
    degraded: '!',
    invalid: '×',
    offline: '×',
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

  if (isMinimal) {
    return (
      <Text color="tovyrPrimary" bold>
        {modeLabel}
      </Text>
    )
  }

  return (
    <Text wrap="truncate-end">
      <Text color={connectionColor[connectionState]}>
        {connectionGlyph[connectionState]}{' '}
      </Text>
      <Text color="tovyrPrimary" bold>
        {modeLabel}
      </Text>
      {modelLabel ? (
        <Text dimColor color="subtle">
          {' / '}
          <Text color="tovyrPrimary" dimColor>
            {modelLabel}
          </Text>
        </Text>
      ) : null}
    </Text>
  )
}
