import { memo, type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import {
  buildToolPresentation,
  formatDuration,
  shouldExpandTool,
  toolCategoryGlyph,
  type ToolDetailMode,
  type ToolPresentationStatus,
  type ToolRisk,
} from '../../services/tovyr/dx/toolPresentation.js'
import {
  formatToolLabel,
  type OpenCodeToolLine,
} from '../../services/tovyr/dx/activityDisplay.js'
import {
  classifyCommandRisk,
  commandRiskColor,
  commandRiskGlyph,
} from '../../services/tovyr/dx/commandRisk.js'

import figures from 'figures'

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
  queued: figures.circle,
  'waiting-approval': figures.warning,
  running: figures.bullet,
  succeeded: figures.tick,
  failed: figures.cross,
  cancelled: figures.line,
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
  const categoryIcon = !line ? `${toolCategoryGlyph(tool.category)} ` : ''
  const expanded = shouldExpandTool(tool, detailMode)
  const isActive = status === 'queued' || status === 'running'
  const failed = status === 'failed'
  const waiting = status === 'waiting-approval'

  // A consequential command stays visually marked after it runs, not just
  // while it is waiting for approval — the transcript is what someone scrolls
  // back through when they want to know what touched their machine.
  const commandText =
    typeof input.command === 'string' ? input.command : ''
  const commandRisk = commandText
    ? classifyCommandRisk(commandText)
    : { level: 'none' as const, label: null }
  const riskGlyph = commandRiskGlyph(commandRisk.level)
  const riskColor = commandRiskColor(commandRisk.level)

  // Failure still wins the colour: what went wrong outranks what was risky.
  //
  // A finished tool call is history. Painting every one of them green made a
  // working transcript a wall of colour with no hierarchy — the eye had no way
  // to find the one row that mattered. Colour is now spent only on what needs
  // attention: what is running, what is risky, and what broke. Everything
  // settled recedes to grey.
  const color = failed
    ? 'error'
    : waiting
      ? 'warning'
      : (riskColor ?? (isActive ? 'tovyrPrimary' : 'subtle'))

  // Completed rows dim as a block so the assistant's prose, not the tool log,
  // reads as the foreground of the conversation.
  const settled = !isActive && !failed && !waiting && !riskColor
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
        <Text color={color} bold={isActive || failed || waiting} dimColor={settled}>
          {riskGlyph || line?.prefix || STATUS_GLYPH[status]}
        </Text>
        <Text wrap="truncate-end" inverse={selected}>
          <Text
            color={failed ? 'error' : 'text'}
            bold={isActive}
            dimColor={settled}
          >
            {categoryIcon}
            {line?.text ?? formatToolLabel(tool.label, tool.inputSummary)}
          </Text>
          {commandRisk.label ? (
            <Text color={riskColor ?? 'warning'}>{` · ${commandRisk.label}`}</Text>
          ) : null}
          {meta ? <Text color="subtle" dimColor>{` · ${meta}`}</Text> : null}
          {suffix ? <Text color="inactive" dimColor>{suffix}</Text> : null}
          {isActive ? <Text color="tovyrPrimary">{' …'}</Text> : null}
          {selected && tool.expandable ? (
            <Text color="tovyrSecondary">{'  Enter details'}</Text>
          ) : null}
        </Text>
      </Box>
      {expanded && (tool.resultSummary || tool.detail || failed) ? (
        <Box paddingLeft={2} flexDirection="column">
          {tool.resultSummary || failed ? (
            <Text color={failed ? 'error' : 'subtle'} wrap="truncate-end">
              {failed ? '! ' : '↳ '}
              {/* A failure with no result text still has to say so — silently
                  rendering an empty row is how `✗ Glob "*"` came to mean
                  nothing at all. */}
              {tool.resultSummary ?? 'failed with no output'}
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
