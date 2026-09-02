import { useMemo } from 'react'
import { Box, Text } from '../../ink.js'
import {
  formatCost,
  getTotalCostUSD,
  getTotalInputTokens,
  getTotalOutputTokens,
} from '../../cost-tracker.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import { formatNumber } from '../../utils/format.js'

type Props = {
  isLoading?: boolean
}

/** OpenCode-style session cost + token meter for the Tovyr footer. */
export function TovyrCostMeter({ isLoading = false }: Props): React.ReactNode {
  const data = useMemo(() => {
    if (!isTovyrRuntime()) return null
    const inTok = getTotalInputTokens()
    const outTok = getTotalOutputTokens()
    const costUSD = getTotalCostUSD()
    if (inTok === 0 && outTok === 0 && costUSD === 0) return null
    const cost = formatCost(costUSD)
    const total = inTok + outTok
    return { inTok, outTok, cost, total }
  }, [isLoading])

  if (!data) return null

  return (
    <Box flexDirection="row" gap={1}>
      <Text color="tovyrPrimary" bold>
        ${data.cost}
      </Text>
      <Text dimColor color="subtle">
        <Text color="tovyrPrimary" dimColor>{formatNumber(data.total)}</Text>
        {' tokens'}
      </Text>
      <Text dimColor color="subtle">
        <Text color="inactive" dimColor>{formatNumber(data.inTok)}</Text>
        {' in / '}
        <Text color="inactive" dimColor>{formatNumber(data.outTok)}</Text>
        {' out'}
      </Text>
    </Box>
  )
}
