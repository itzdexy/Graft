import * as React from 'react'
import { Box, Text } from '../../ink.js'
import type { Theme } from '../../utils/theme.js'

type EmptyStateProps = {
  sprite?: string[]
  title?: string
  children: React.ReactNode
  /** Optional action hint shown below the description. */
  hint?: string
  /** Theme color for the title. */
  color?: keyof Theme
}

const MEMORY_SPRITE = [
  '  .---.  ',
  ' /     \\ ',
  '(  ???  )',
  ' \\     / ',
  '  `---`  ',
]

const CALENDAR_SPRITE = [
  ' .-------.',
  ' | ? ? ? |',
  ' | ? ? ? |',
  ' | ? ? ? |',
  ' `-------`',
]

const SEARCH_SPRITE = [
  '    .-.  ',
  '   /   \\ ',
  '  |  o  |',
  '   \\   / ',
  '    | |  ',
]

const FOLDER_SPRITE = [
  '  .---.',
  ' / ??? \\',
  '| ??? ??? |',
  ' \\ ??? /',
  '  `---`',
]

const BUG_SPRITE = [
  '   .-.   ',
  '  ( o )  ',
  '  / | \\  ',
  " '  |  ' ",
  '    |    ',
]

const GEAR_SPRITE = [
  '  .---.  ',
  ' /  |  \\ ',
  ' |  *  | ',
  ' \\  |  / ',
  '  `---`  ',
]

export const EMPTY_STATE_SPRITES = {
  memory: MEMORY_SPRITE,
  calendar: CALENDAR_SPRITE,
  search: SEARCH_SPRITE,
  folder: FOLDER_SPRITE,
  bug: BUG_SPRITE,
  gear: GEAR_SPRITE,
}

export function EmptyState({ sprite, title, children, hint, color }: EmptyStateProps): React.ReactNode {
  return (
    <Box flexDirection="row" gap={2}>
      {sprite && (
        <Box flexDirection="column">
          {sprite.map((line, i) => (
            <Text key={i} dimColor color={color}>
              {line}
            </Text>
          ))}
        </Box>
      )}
      <Box flexDirection="column" justifyContent="center" gap={0}>
        {title && (
          <Text bold color={color}>
            {title}
          </Text>
        )}
        <Text dimColor>{children}</Text>
        {hint && (
          <Text dimColor color="subtle">
            <Text color={color ?? 'tovyrPrimary'} bold>{'>'}</Text> {hint}
          </Text>
        )}
      </Box>
    </Box>
  )
}
