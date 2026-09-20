import { memo, type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import type { Theme } from '../../utils/theme.js'

type Role = 'you' | 'graft' | 'system'
type Variant = 'default' | 'error'

type Props = {
  role: Role
  children: ReactNode
  addMargin?: boolean
  variant?: Variant
}

const ROLE_ACCENT: Record<Role, keyof Theme> = {
  you: 'graftSecondary',
  graft: 'graftPrimary',
  system: 'warning',
}

/**
 * Gutter marker per role. Roles read from colour and weight rather than a
 * spelled-out "You"/"Graft" column, which is what gives the transcript its
 * flat, uninterrupted column instead of a labelled table.
 */
const ROLE_GLYPH: Record<Role, string> = {
  you: '▌',
  graft: '▌',
  system: '·',
}

/**
 * Width of the gutter, in columns. Chosen so prose starts at column 3 — the
 * same column GraftCompactToolRow puts its tool text in (1 padding + 1 glyph +
 * 1 gap). Prose and tool rows therefore share a single left edge; changing
 * either one alone will visibly break the alignment.
 */
const GUTTER_WIDTH = 2

/**
 * Flat conversation turn: an accent rail and one shared text column.
 *
 * The user's turn used to sit on a full-width filled surface. That made every
 * prompt a heavy card and turned a long session into a stack of boxes, with
 * the eye stopping at each edge instead of running down the conversation. The
 * rail alone is enough to find a prompt when scrolling — a continuous vertical
 * line in a column of text that has none — and it keeps the transcript reading
 * as one document rather than a feed of cards. If a prompt ever becomes hard
 * to spot, thicken or brighten the rail rather than reintroducing a fill.
 */
export const GraftChatTurn = memo(function GraftChatTurn({
  role,
  children,
  addMargin = false,
  variant = 'default',
}: Props): ReactNode {
  const accent = variant === 'error' ? 'error' : ROLE_ACCENT[role]
  // The assistant owns the page: its rule recedes so that answers read as the
  // document, while the user's turn stays a bright, scannable landmark.
  const recede = role === 'graft'

  return (
    <Box
      flexDirection="row"
      width="100%"
      marginTop={addMargin ? 1 : 0}
      marginBottom={role === 'you' ? 1 : 0}
      paddingX={1}
    >
      <Box width={GUTTER_WIDTH} flexShrink={0}>
        <Text color={accent} bold={!recede} dimColor={recede}>
          {ROLE_GLYPH[role]}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
    </Box>
  )
})
