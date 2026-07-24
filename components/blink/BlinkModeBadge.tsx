import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Text } from '../../ink.js'
import {
  isSuperthinkEnabled,
  subscribeSuperthinkState,
} from '../../services/blink/superthink/state.js'
import {
  isCrushModeEnabled,
  subscribeCrushState,
} from '../../services/blink/ecosystem/crush/state.js'
import type { ToolPermissionContext } from '../../Tool.js'
import type { PromptInputMode } from '../../types/textInputTypes.js'
import { isBlinkModeMinimal } from '../../services/blink/terminalLayout.js'
import { subscribeCwdState } from '../../bootstrap/state.js'
import { getCwd } from '../../utils/cwd.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { renderModelName } from '../../utils/model/model.js'
import { openCodeModeLabel } from '../../services/blink/dx/activityDisplay.js'

function subscribeBlinkModeFooter(listener: () => void): () => void {
  const unsubSuperthink = subscribeSuperthinkState(listener)
  const unsubCrush = subscribeCrushState(listener)
  const unsubCwd = subscribeCwdState(listener)
  return () => {
    unsubSuperthink()
    unsubCrush()
    unsubCwd()
  }
}

function blinkModeFooterSnapshot(): string {
  const cwd = getCwd()
  return `${cwd}\0${isSuperthinkEnabled(cwd)}\0${isCrushModeEnabled(cwd)}`
}

type Props = {
  toolPermissionContext: ToolPermissionContext
  mode: PromptInputMode
}

/**
 * OpenCode-style footer: mode label + model, compact and clean.
 */
export function BlinkModeBadge({
  toolPermissionContext,
  mode,
}: Props): ReactNode {
  useSyncExternalStore(
    subscribeBlinkModeFooter,
    blinkModeFooterSnapshot,
    () => '\0false\0false',
  )
  const model = useMainLoopModel()
  const { columns } = useTerminalSize()
  const isMinimal = isBlinkModeMinimal(columns)

  if (!isBlinkRuntime()) return null

  const cwd = getCwd()
  const modeLabel =
    isSuperthinkEnabled(cwd)
      ? 'Superthink'
      : isCrushModeEnabled(cwd)
        ? 'Crush'
        : openCodeModeLabel(toolPermissionContext.mode, mode)
  const modelLabel = renderModelName(model)

  if (isMinimal) {
    return (
      <Text color="blinkPrimary" bold>
        {modeLabel}
      </Text>
    )
  }

  return (
    <Text wrap="truncate-end">
      <Text color="blinkPrimary" bold>
        {modeLabel}
      </Text>
      {modelLabel ? (
        <Text dimColor color="subtle">
          {' · '}
          <Text color="blinkPrimary" dimColor>{modelLabel}</Text>
        </Text>
      ) : null}
    </Text>
  )
}
