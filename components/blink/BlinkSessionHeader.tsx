import { useMemo, type ReactNode } from 'react'
import { basename } from 'path'
import { Box, Text } from '../../ink.js'
import {
  getTotalCostUSD,
  getTotalInputTokens,
  getTotalOutputTokens,
} from '../../cost-tracker.js'
import { getSdkBetas, getSessionId } from '../../bootstrap/state.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { getContextWindowForModel } from '../../utils/context.js'
import { getCwd } from '../../utils/cwd.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { hasActiveBlinkAgentSession } from '../../services/blink/agent/autoBootstrap.js'
import { loadAgentSession } from '../../services/blink/agent/persistence.js'
import {
  formatOpenCodeMetricsLine,
  formatOpenCodeTaskTitle,
} from '../../services/blink/dx/activityDisplay.js'
import { getBlinkLiveTokenEstimate } from '../../services/blink/dx/tokenDisplay.js'
import { getCurrentSessionTitle } from '../../utils/sessionStorage.js'

type Props = {
  isLoading?: boolean
  /** Bump when transcript changes so token totals refresh. */
  refreshKey?: number
  /** Optional override for the task title (defaults to session rename / agent goal / project). */
  taskTitle?: string | null
}

/**
 * OpenCode-style session chrome:
 * `# Task title` … `39,413  20%  ($0.29)`
 * Title prefers `/rename` custom title; use `/rename <name>` to edit.
 */
export function BlinkSessionHeader({
  isLoading = false,
  refreshKey = 0,
  taskTitle,
}: Props): ReactNode {
  const model = useMainLoopModel()

  const data = useMemo(() => {
    if (!isBlinkRuntime()) return null
    const inTok = getTotalInputTokens()
    const outTok = getTotalOutputTokens()
    const sessionTokens = inTok + outTok
    const contextTokens = getBlinkLiveTokenEstimate([])
    const tokens = Math.max(sessionTokens, contextTokens)
    const cost = getTotalCostUSD()
    const contextWindow = getContextWindowForModel(model, getSdkBetas())
    const cwd = getCwd()
    const project = basename(cwd) || cwd
    const session = hasActiveBlinkAgentSession(cwd)
      ? loadAgentSession(cwd)
      : null
    const goal = session?.goal.text ?? null
    const renamed = getCurrentSessionTitle(getSessionId())
    const explicitTitle = taskTitle?.trim() || renamed || goal
    const title = explicitTitle || project
    return {
      title,
      tokens,
      cost,
      contextWindow,
      hasAgent: !!goal,
      hasExplicitTitle: !!explicitTitle,
    }
  }, [model, isLoading, refreshKey, taskTitle])

  if (!data || (!data.hasExplicitTitle && !isLoading)) return null

  const metrics = formatOpenCodeMetricsLine({
    tokens: data.tokens,
    contextWindow: data.contextWindow,
    costUsd: data.cost,
  })

  return (
    <Box flexDirection="column" width="100%" marginBottom={1} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        <Box flexGrow={1} marginRight={2} flexDirection="row">
          <Text color="blinkPrimary" dimColor bold>
            {'# '}
          </Text>
          <Text color="text" bold wrap="truncate-end">
            {formatOpenCodeTaskTitle(data.title)}
          </Text>
          {data.hasAgent ? (
            <Text color="blinkPrimary" dimColor>
              {' '}
              <Text color="blinkPrimary" bold>agent</Text>
            </Text>
          ) : null}
          {isLoading ? (
            <Text color="blinkPrimary" bold>
              {' !'}
            </Text>
          ) : null}
        </Box>
        {metrics ? (
          <Text dimColor color="blinkPrimary" wrap="truncate-end">
            {metrics}
          </Text>
        ) : null}
      </Box>
      <Box
        borderStyle="single"
        borderColor="subtle"
        borderDimColor
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        marginTop={0}
      />
    </Box>
  )
}
