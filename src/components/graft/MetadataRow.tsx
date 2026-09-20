import * as React from 'react'
import { Box, Text } from '../../ink.js'

type Props = {
  mode: string
  model: string
  thinking?: string
  agent?: string
  contextPercent?: number
}

/**
 * Compact metadata row shown inside or directly below the composer.
 * Displays mode, model, thinking level, and optionally context usage.
 */
export function MetadataRow({
  mode,
  model,
  thinking,
  agent,
  contextPercent,
}: Props): React.ReactNode {
  const items: React.ReactNode[] = []

  items.push(
    <Text key="mode" color="graftPrimary" bold>
      {mode}
    </Text>,
  )

  items.push(<Text key="dot1" color="subtle" dimColor> · </Text>)

  items.push(
    <Text key="model" color="text">
      {model}
    </Text>,
  )

  if (thinking) {
    items.push(<Text key="dot2" color="subtle" dimColor> · </Text>)
    items.push(
      <Text key="thinking" color="subtle">
        {thinking}
      </Text>,
    )
  }

  if (agent) {
    items.push(<Text key="dot3" color="subtle" dimColor> · </Text>)
    items.push(
      <Text key="agent" color="subtle">
        {agent}
      </Text>,
    )
  }

  if (contextPercent !== undefined && contextPercent > 0) {
    items.push(<Text key="dot4" color="subtle" dimColor> · </Text>)
    const color =
      contextPercent >= 90 ? 'error' : contextPercent >= 70 ? 'warning' : 'subtle'
    items.push(
      <Text key="ctx" color={color}>
        {contextPercent}% context
      </Text>,
    )
  }

  return (
    <Box flexDirection="row" flexWrap="wrap" gap={0}>
      {items}
    </Box>
  )
}
