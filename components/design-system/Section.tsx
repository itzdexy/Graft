import * as React from 'react'
import { Box, Text } from '../../ink.js'
import type { Theme } from '../../utils/theme.js'

type SectionProps = {
  title?: string
  children: React.ReactNode
  gap?: 0 | 1
  /** Show a divider line under the title. */
  divider?: boolean
  /** Theme color for the title accent. */
  color?: keyof Theme
}

export function Section({
  title,
  children,
  gap = 0,
  divider = false,
  color = 'tovyrPrimary',
}: SectionProps): React.ReactNode {
  return (
    <Box flexDirection="column" marginTop={1}>
      {title && (
        <Box flexDirection="column" marginBottom={divider ? 0 : 1}>
          <Text bold color={color}>
            {title}
          </Text>
          {divider && (
            <Box
              borderStyle="single"
              borderColor={color}
              borderDimColor
              borderTop={false}
              borderLeft={false}
              borderRight={false}
            />
          )}
        </Box>
      )}
      <Box flexDirection="column" gap={gap} marginTop={title ? (divider ? 1 : 0) : 0}>
        {children}
      </Box>
    </Box>
  )
}
