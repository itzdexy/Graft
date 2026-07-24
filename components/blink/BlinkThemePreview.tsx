import type { ReactNode } from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text } from '../../ink.js'
import { isBlinkStatusCompact } from '../../services/blink/terminalLayout.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'

/** Mini Blink prompt/footer strip shown under /theme diff preview. */
export function BlinkThemePreview(): ReactNode {
  const { columns } = useTerminalSize()

  if (!isBlinkRuntime() || isBlinkStatusCompact(columns)) return null

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="blinkPrimary"
      borderDimColor
      paddingX={1}
    >
      <Text color="blinkPrimary" dimColor bold>
        <Text color="blinkPrimary">{'| '}</Text>Blink UI preview
      </Text>
      <Box flexDirection="row" marginTop={0}>
        <Text color="blinkPrimary" bold>
          {'> '}
        </Text>
        <Text color="inactive" dimColor>
          Ask Blink anything...
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
        <Text color="blinkPrimary" bold>
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
          <Text color="blinkPrimary" bold>{'| '}</Text>Blink
        </Text>
        <Text dimColor color="subtle">
          <Text color="blinkPrimary">{'  > '}</Text>Reading file.ts...
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
          <Text color="blinkPrimary" bold>?</Text> help{'  ·  '}
          <Text color="blinkPrimary" bold>/</Text> commands{'  ·  '}
          <Text color="blinkPrimary" bold>Up</Text> history
        </Text>
        <Text>
          <Text color="blinkPrimary" dimColor>
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
