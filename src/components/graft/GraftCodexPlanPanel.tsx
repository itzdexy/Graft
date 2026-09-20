import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import {
  parseCodexPlanDisplay,
  type CodexPlanDisplay,
} from '../../services/graft/dx/codexPlanDisplay.js'

type Props = {
  planMarkdown: string
  /** Override parsed title (default: Updated Plan). */
  title?: string
  display?: CodexPlanDisplay
}

/**
 * Codex-style plan block: `• Updated Plan` + `↳` summary + `[ ]` checklist.
 */
export function GraftCodexPlanPanel({
  planMarkdown,
  title,
  display,
}: Props): ReactNode {
  const parsed = display ?? parseCodexPlanDisplay(planMarkdown)
  const heading = title ?? parsed.title

  if (parsed.items.length === 0 && !parsed.summary) {
    return null
  }

  return (
    <Box flexDirection="column" marginY={1} paddingX={1}>
      <Box flexDirection="row">
        <Text color="graftPrimary" bold>{'| '}</Text>
        <Text bold color="graftPrimary">{heading}</Text>
      </Box>
      {parsed.summary ? (
        <Box paddingLeft={2}>
          <Text dimColor color="subtle">
            <Text color="graftPrimary" bold>{'> '}</Text>{parsed.summary}
          </Text>
        </Box>
      ) : null}
      {parsed.items.map((item, i) => (
        <Box key={`${i}-${item.text.slice(0, 24)}`} paddingLeft={2}>
          <Text>
            <Text
              color={item.done ? 'success' : item.active ? 'graftPrimary' : 'subtle'}
              bold={item.done || item.active}
              dimColor={!item.done && !item.active}
            >
              [{item.done ? 'x' : item.active ? '>' : ' '}]
            </Text>
            <Text> </Text>
            <Text
              color={item.active ? 'graftPrimary' : item.done ? 'subtle' : 'text'}
              dimColor={item.done}
              bold={!!item.active}
            >
              {item.text}
            </Text>
            {item.active ? (
              <Text color="graftPrimary" dimColor bold>{' ...'}</Text>
            ) : null}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
