import * as React from 'react'
import { Box, Text } from '../../ink.js'
import type { Theme } from '../../utils/theme.js'

type CardProps = {
  children: React.ReactNode
  title?: string
  subtitle?: string
  color?: keyof Theme
  footer?: React.ReactNode
  /** Show a rounded border around the card. */
  bordered?: boolean
  /** Show a colored accent bar on the left side. */
  accent?: boolean
}

export function Card({
  children,
  title,
  subtitle,
  color,
  footer,
  bordered = false,
  accent = true,
}: CardProps): React.ReactNode {
  const accentColor = color ?? 'tovyrPrimary'

  const inner = (
    <Box flexDirection="column" paddingX={1}>
      {title && (
        <Box flexDirection="column" marginBottom={1}>
          <Box flexDirection="row">
            {accent && (
              <Text color={accentColor} bold>
                {'| '}
              </Text>
            )}
            <Text bold color={color}>
              {title}
            </Text>
          </Box>
          {subtitle && (
            <Text dimColor color="subtle">
              {accent ? '  ' : ''}{subtitle}
            </Text>
          )}
        </Box>
      )}
      {children}
      {footer && (
        <Box flexDirection="column" marginTop={1}>
          <Box
            borderStyle="single"
            borderColor="subtle"
            borderDimColor
            borderTop={false}
            borderLeft={false}
            borderRight={false}
          />
          <Text dimColor color="subtle">
            {footer}
          </Text>
        </Box>
      )}
    </Box>
  )

  if (bordered) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={accentColor}
        borderDimColor
      >
        {inner}
      </Box>
    )
  }

  return inner
}
