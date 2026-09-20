import type { ReactNode } from 'react'
import { extractToolResultPreview } from '../../services/graft/dx/toolResultText.js'
import { Box, Text } from '../../ink.js'
import type { CollapsedReadSearchGroup } from '../../types/message.js'
import type { buildMessageLookups } from '../../utils/messages.js'
import { GraftCompactToolRow } from './GraftCompactToolRow.js'
import {
  buildToolPresentation,
  summarizeToolGroup,
} from '../../services/graft/dx/toolPresentation.js'

type ToolUseRow = {
  id: string
  name: string
  input: Record<string, unknown>
}

function collectToolUses(message: CollapsedReadSearchGroup): ToolUseRow[] {
  const out: ToolUseRow[] = []
  for (const msg of message.messages) {
    if (msg.type === 'assistant') {
      for (const block of msg.message.content) {
        if (block.type !== 'tool_use') continue
        out.push({
          id: block.id,
          name: block.name,
          input:
            block.input && typeof block.input === 'object'
              ? (block.input as Record<string, unknown>)
              : {},
        })
      }
    } else if (msg.type === 'grouped_tool_use') {
      for (const sub of msg.messages) {
        const block = sub.message.content[0]
        if (block?.type !== 'tool_use') continue
        out.push({
          id: block.id,
          name: block.name,
          input:
            block.input && typeof block.input === 'object'
              ? (block.input as Record<string, unknown>)
              : {},
        })
      }
    }
  }
  return out
}

type Props = {
  message: CollapsedReadSearchGroup
  inProgressToolUseIDs: Set<string>
  lookups: ReturnType<typeof buildMessageLookups>
  expanded?: boolean
}

/** OpenCode-style rows for collapsed read/search/list tool groups (Graft). */
export function GraftCollapsedReadSearchGroup({
  message,
  inProgressToolUseIDs,
  lookups,
  expanded = false,
}: Props): ReactNode {
  const toolUses = collectToolUses(message)
  if (toolUses.length === 0) return null

  const isCollapsed = toolUses.length > 2
  const failed = toolUses.filter(tu => lookups.erroredToolUseIDs.has(tu.id))
  const visible = isCollapsed && !expanded
    ? [...toolUses.slice(0, 2), ...failed].filter(
        (tool, index, all) => all.findIndex(item => item.id === tool.id) === index,
      )
    : toolUses
  const summary = summarizeToolGroup(
    toolUses.map(tool =>
      buildToolPresentation({
        id: tool.id,
        toolName: tool.name,
        input: tool.input,
        status: lookups.erroredToolUseIDs.has(tool.id)
          ? 'failed'
          : inProgressToolUseIDs.has(tool.id)
            ? 'running'
            : 'succeeded',
      }),
    ),
  )

  return (
    <Box flexDirection="column" marginTop={0}>
      {isCollapsed ? (
        <Box paddingLeft={1} marginBottom={0}>
          <Text color="subtle" dimColor>
            <Text color="graftPrimary" bold>{'│ '}</Text>
            <Text color="text">{summary}</Text>
            {failed.length > 0 ? (
              <Text color="error" bold>{` · ${failed.length} failed`}</Text>
            ) : null}
            <Text color="subtle">{expanded ? ' · all details' : ' · Enter details'}</Text>
          </Text>
        </Box>
      ) : null}
      {isCollapsed
        ? visible.map(tu => {
            const inProgress =
              inProgressToolUseIDs.has(tu.id) && !lookups.resolvedToolUseIDs.has(tu.id)
            const ok =
              lookups.resolvedToolUseIDs.has(tu.id) &&
              !lookups.erroredToolUseIDs.has(tu.id)
            return (
              <GraftCompactToolRow
                key={tu.id}
                toolName={tu.name}
                input={tu.input}
                inProgress={inProgress}
                ok={ok}
                resultPreview={extractToolResultPreview(lookups.toolResultByToolUseID?.get(tu.id), tu.id)}
              />
            )
          })
        : toolUses.map(tu => {
            const inProgress =
              inProgressToolUseIDs.has(tu.id) && !lookups.resolvedToolUseIDs.has(tu.id)
            const ok =
              lookups.resolvedToolUseIDs.has(tu.id) &&
              !lookups.erroredToolUseIDs.has(tu.id)
            return (
              <GraftCompactToolRow
                key={tu.id}
                toolName={tu.name}
                input={tu.input}
                inProgress={inProgress}
                ok={ok}
                resultPreview={extractToolResultPreview(lookups.toolResultByToolUseID?.get(tu.id), tu.id)}
              />
            )
          })}
      {isCollapsed && !expanded && toolUses.length > 2 ? (
        <Box paddingLeft={1}>
          <Text color="subtle" dimColor>
            {'  + '}{toolUses.length - 2} more
          </Text>
        </Box>
      ) : null}
    </Box>
  )
}
