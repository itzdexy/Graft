import * as React from 'react'
import { Box, Text } from '../../ink.js'

type SkeletonProps = {
  lines?: number
  width?: number
}

export function Skeleton({ lines = 3, width = 24 }: SkeletonProps): React.ReactNode {
  return (
    <Box flexDirection="column" gap={0}>
      {Array.from({ length: lines }).map((_, i) => {
        const w = i === lines - 1 ? Math.floor(width * 0.7) : width
        return (
          <Text key={i} dimColor color="subtle">
            {'='.repeat(w)}
          </Text>
        )
      })}
    </Box>
  )
}
