import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { BlinkChatTurn } from './BlinkChatTurn.js'

/** Shown when a turn completes with no visible assistant reply in scrollback. */
export function BlinkSilentTurnNotice(): ReactNode {
  return (
    <BlinkChatTurn role="blink" addMargin={false}>
      <Box flexDirection="column">
        <Text color="warning" dimColor wrap="wrap">
          <Text color="warning" bold>{'! '}</Text>
          Blink finished without a visible reply. The model may have returned an empty
          response.
        </Text>
        <Box flexDirection="column" marginTop={0}>
          <Text color="subtle" dimColor>
            <Text color="blinkPrimary" bold>{'> '}</Text>Try sending your message again
          </Text>
          <Text color="subtle" dimColor>
            <Text color="blinkPrimary" bold>{'> '}</Text>Use <Text color="blinkPrimary" bold>/model</Text> to switch providers
          </Text>
          <Text color="subtle" dimColor>
            <Text color="blinkPrimary" bold>{'> '}</Text>Run <Text color="blinkPrimary" bold>blink doctor</Text> for diagnostics
          </Text>
        </Box>
      </Box>
    </BlinkChatTurn>
  )
}
