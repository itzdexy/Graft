import type { ReactNode } from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text } from '../../ink.js'
import { isTovyrStatusCompact } from '../../services/tovyr/terminalLayout.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'

/** Mini Tovyr prompt/footer strip shown under /theme diff preview. */
export function TovyrThemePreview(): ReactNode {
  const { columns } = useTerminalSize()

  if (!isTovyrRuntime() || isTovyrStatusCompact(columns)) return null

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="tovyrPrimary"
      borderDimColor
      paddingX={1}
    >
      <Text color="tovyrPrimary" dimColor bold>
        <Text color="tovyrPrimary">{'| '}</Text>Tovyr UI preview
      </Text>
      <Box flexDirection="row" marginTop={0}>
        <Text color="tovyrPrimary" bold>
          {'> '}
        </Text>
        <Text color="inactive" dimColor>
          Ask Tovyr anything...
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
        <Text color="tovyrPrimary" bold>
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
          <Text color="tovyrPrimary" bold>{'| '}</Text>Tovyr
        </Text>
        <Text dimColor color="subtle">
          <Text color="tovyrPrimary">{'  > '}</Text>Reading file.ts...
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
          <Text color="tovyrPrimary" bold>?</Text> help{'  ·  '}
          <Text color="tovyrPrimary" bold>/</Text> commands{'  ·  '}
          <Text color="tovyrPrimary" bold>Up</Text> history
        </Text>
        <Text>
          <Text color="tovyrPrimary" dimColor>
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
