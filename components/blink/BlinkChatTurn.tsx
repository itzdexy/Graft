import { memo, type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import type { Theme } from '../../utils/theme.js'

type Role = 'you' | 'blink' | 'system'
type Variant = 'default' | 'error'

type Props = {
  role: Role
  children: ReactNode
  addMargin?: boolean
  variant?: Variant
}

const ROLE_LABEL: Record<Role, string> = {
  you: 'You',
  blink: 'Blink',
  system: 'System',
}

const ROLE_ACCENT: Record<Role, keyof Theme> = {
  you: 'blinkSecondary',
  blink: 'blinkPrimary',
  system: 'warning',
}

/** Compact editorial gutter for ordinary conversation turns. */
export const BlinkChatTurn = memo(function BlinkChatTurn({
  role,
  children,
  addMargin = false,
  variant = 'default',
}: Props): ReactNode {
  const accent = variant === 'error' ? 'error' : ROLE_ACCENT[role]

  return (
    <Box
      flexDirection="row"
      width="100%"
      marginTop={addMargin ? 1 : 0}
      paddingX={1}
    >
      <Box width={6} flexShrink={0}>
        <Text color={accent} bold>
          {ROLE_LABEL[role]}
        </Text>
      </Box>
      <Text color={accent} dimColor>
        {role === 'system' ? '· ' : '│ '}
      </Text>
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
    </Box>
  )
})
