import type { ReactNode } from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text } from '../../ink.js'
import { isGraftStatusCompact } from '../../services/graft/terminalLayout.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'

/** Mini Graft prompt/footer strip shown under /theme diff preview. */
export function GraftThemePreview(): ReactNode {
  const { columns } = useTerminalSize()

  if (!isGraftRuntime() || isGraftStatusCompact(columns)) return null

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="graftPrimary"
      borderDimColor
      paddingX={1}
    >
      <Text color="graftPrimary" dimColor bold>
        <Text color="graftPrimary">{'| '}</Text>Graft UI preview
      </Text>
      <Box flexDirection="row" marginTop={0}>
        <Text color="graftPrimary" bold>
          {'> '}
        </Text>
        <Text color="inactive" dimColor>
          Ask Graft anything...
        </Text>
      </Box>
      <Box flexDirection="row" marginTop={0}>
        <Text color="success" bold>
          *
        </Text>
        <Text> </Text>
        <Text color="success" dimColor>
          Agent idle
        </Text>
        <Text color="subtle" dimColor>
          {' · '}
        </Text>
        <Text color="graftPrimary" bold>
          $0.00
        </Text>
        <Text color="subtle" dimColor>
          {' · '}
        </Text>
        <Text color="inactive" dimColor>
          12k in / 4k out
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={0} paddingLeft={1}>
        <Text dimColor color="subtle">
          <Text color="graftPrimary" bold>{'| '}</Text>Graft
        </Text>
        <Text dimColor color="subtle">
          <Text color="graftPrimary">{'  > '}</Text>Reading file.ts...
        </Text>
        <Text dimColor color="subtle">
          <Text color="success" bold>{'  * '}</Text>Write src/index.ts
        </Text>
        <Text dimColor color="subtle">
          <Text color="error" bold>{'  ! '}</Text>Rate limited -- retrying...
        </Text>
      </Box>
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        <Text color="inactive" dimColor>
          <Text color="graftPrimary" bold>?</Text> help{'  ·  '}
          <Text color="graftPrimary" bold>/</Text> commands{'  ·  '}
          <Text color="graftPrimary" bold>Up</Text> history
        </Text>
        <Text>
          <Text color="graftPrimary" dimColor>
            mode{' '}
          </Text>
          <Text color="planMode" dimColor>
            plan{' '}
          </Text>
          <Text color="autoAccept" bold>
            [code]
          </Text>
          <Text color="error" dimColor>
            {' '}bypass
          </Text>
        </Text>
      </Box>
    </Box>
  )
}
