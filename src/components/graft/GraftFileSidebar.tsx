import React, { memo } from 'react'
import { Box, Text } from '../../ink.js'
import { useProjectTaskMap } from '../../hooks/useProjectTaskMap.js'
import { GraftProjectMapPanel } from './GraftProjectMapPanel.js'

const SIDEBAR_WIDTH = 28

export const GraftFileSidebar = memo(function GraftFileSidebar({
  root,
  taskQuery,
}: {
  root: string
  taskQuery?: string
}): React.ReactNode {
  const map = useProjectTaskMap(root, taskQuery)

  return (
    <Box
      width={SIDEBAR_WIDTH}
      flexShrink={0}
      flexDirection="column"
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderRight
      borderDimColor
      paddingLeft={1}
      marginRight={1}
      overflow="hidden"
    >
      <Box flexShrink={0} flexDirection="column" marginBottom={1}>
        <Text color="graftPrimary" bold wrap="truncate-end">
          <Text color="graftPrimary">{'| '}</Text>Project map
        </Text>
        <Text color="subtle" dimColor wrap="truncate-end">
          {map.indexed
            ? <Text><Text color="graftPrimary" bold>{map.fileCount}</Text> files</Text>
            : <Text color="warning">Indexing...</Text>}
        </Text>
      </Box>
      <GraftProjectMapPanel
        map={map}
        width={SIDEBAR_WIDTH - 2}
        variant="sidebar"
        taskQuery={taskQuery}
      />
    </Box>
  )
})
