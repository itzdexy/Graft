import { memo, useEffect, useState, type ReactNode } from 'react'
import { basename } from 'path'
import { Box, Text } from '../../ink.js'
import { getOriginalCwd } from '../../bootstrap/state.js'
import { getBranch } from '../../utils/git.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { truncateToWidth } from '../../utils/format.js'
import { BREAKPOINTS } from '../design-system/spacing.js'

type Props = {
  indexingProgress?: number | null
  indexingFileCount?: number | null
}

function useGitBranch(): string | undefined {
  const [branch, setBranch] = useState<string | undefined>()
  useEffect(() => {
    let alive = true
    void getBranch()
      .then(value => {
        if (alive) setBranch(value)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return branch
}

/** Identity only; operational metadata belongs beside the real composer. */
export const TovyrHeader = memo(function TovyrHeader({
  indexingProgress,
  indexingFileCount,
}: Props): ReactNode {
  const { columns } = useTerminalSize()
  const project = truncateToWidth(
    basename(getOriginalCwd() || '.'),
    Math.max(8, Math.floor(columns * 0.45)),
  )
  const rawBranch = useGitBranch()
  const branch = columns >= BREAKPOINTS.narrow ? rawBranch : undefined
  const isIndexing = indexingProgress != null && indexingProgress < 100
  const separator = ' · '

  return (
    <Box flexDirection="row" width="100%" paddingX={1} flexShrink={0}>
      <Text>
        <Text color="tovyrPrimary" bold>Tovyr</Text>
        <Text color="subtle" dimColor>{separator}</Text>
        <Text color="text" dimColor>{project}</Text>
        {branch ? (
          <>
            <Text color="subtle" dimColor>{separator}</Text>
            <Text color="tovyrSecondary" dimColor>{branch}</Text>
          </>
        ) : null}
        {isIndexing ? (
          <>
            <Text color="subtle" dimColor>{separator}</Text>
            <Text color="warning" bold>
              {indexingFileCount != null
                ? `INDEX ${Math.round(indexingProgress)}% (${indexingFileCount})`
                : `INDEX ${Math.round(indexingProgress)}%`}
            </Text>
          </>
        ) : null}
      </Text>
    </Box>
  )
})
