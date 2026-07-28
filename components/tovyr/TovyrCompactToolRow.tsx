import { memo, type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import {
  buildToolPresentation,
  formatDuration,
  shouldExpandTool,
  type ToolDetailMode,
  type ToolPresentationStatus,
  type ToolRisk,
} from '../../services/tovyr/dx/toolPresentation.js'
import type { OpenCodeToolLine } from '../../services/tovyr/dx/activityDisplay.js'

type Props = {
  toolName: string
  input: Record<string, unknown>
  inProgress?: boolean
  ok?: boolean
  shouldShowDot?: boolean
  addMargin?: boolean
  line?: OpenCodeToolLine
  suffix?: string
  nested?: boolean
  matchCount?: number
  resultPreview?: string
  selected?: boolean
  status?: ToolPresentationStatus
  detailMode?: ToolDetailMode
  detail?: string
  durationMs?: number
  exitCode?: number
  risk?: ToolRisk
}

const STATUS_GLYPH: Record<ToolPresentationStatus, string> = {
  queued: '○',
  'waiting-approval': '?',
  running: '●',
  succeeded: '✓',
  failed: '×',
  cancelled: '–',
}

/** Shared lifecycle row used by shell, file, web, MCP, and agent tools. */
export const TovyrCompactToolRow = memo(function TovyrCompactToolRow({
  toolName,
  input,
  inProgress = false,
  ok = true,
  addMargin = false,
  line,
  suffix,
  nested = false,
  matchCount,
  resultPreview,
  selected = false,
  status: statusProp,
  detailMode = 'smart',
  detail,
  durationMs,
  exitCode,
  risk = 'none',
}: Props): ReactNode {
  const status =
    statusProp ?? (inProgress ? 'running' : ok ? 'succeeded' : 'failed')
  const tool = buildToolPresentation({
    toolName,
    input,
    status,
    resultSummary: resultPreview,
    detail,
    durationMs,
    exitCode,
    matchCount,
    risk,
  })
  const expanded = shouldExpandTool(tool, detailMode)
  const isActive = status === 'queued' || status === 'running'
  const failed = status === 'failed'
  const waiting = status === 'waiting-approval'
  const color = failed ? 'error' : waiting ? 'warning' : isActive ? 'tovyrPrimary' : 'success'
  const meta = [
    matchCount != null ? `${matchCount} matches` : '',
    formatDuration(durationMs),
    exitCode != null ? `exit ${exitCode}` : '',
  ].filter(Boolean).join(' · ')

  return (
    <Box
      flexDirection="column"
      width="100%"
      marginTop={addMargin ? 1 : 0}
      paddingLeft={nested ? 3 : 1}
      minHeight={1}
    >
      <Box flexDirection="row" width="100%" gap={1}>
        <Text color={color} bold={isActive || failed || waiting}>
          {line?.prefix ?? STATUS_GLYPH[status]}
        </Text>
        <Text wrap="truncate-end" inverse={selected}>
          <Text color={failed ? 'error' : 'text'} bold={isActive}>
            {line?.text ?? `${tool.label}(${tool.inputSummary})`}
          </Text>
          {meta ? <Text color="subtle" dimColor>{` · ${meta}`}</Text> : null}
          {suffix ? <Text color="inactive" dimColor>{suffix}</Text> : null}
          {isActive ? <Text color="tovyrPrimary">{' …'}</Text> : null}
          {selected && tool.expandable ? (
            <Text color="tovyrSecondary">{'  Enter details'}</Text>
          ) : null}
        </Text>
      </Box>
      {expanded && (tool.resultSummary || tool.detail) ? (
        <Box paddingLeft={2} flexDirection="column">
          {tool.resultSummary ? (
            <Text color={failed ? 'error' : 'subtle'} wrap="truncate-end">
              {failed ? '! ' : '↳ '}{tool.resultSummary}
            </Text>
          ) : null}
          {tool.detail && tool.detail !== tool.resultSummary ? (
            <Text color="subtle" dimColor>{tool.detail}</Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  )
})
