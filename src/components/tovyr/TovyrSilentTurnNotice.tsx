import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { TovyrChatTurn } from './TovyrChatTurn.js'

/** Shown when a turn completes with no visible assistant reply in scrollback. */
export function TovyrSilentTurnNotice(): ReactNode {
  return (
    <TovyrChatTurn role="tovyr" addMargin={false}>
      <Box flexDirection="column">
        <Text color="warning" dimColor wrap="wrap">
          <Text color="warning" bold>{'! '}</Text>
          Tovyr finished without a visible reply. The model may have returned an empty
          response.
        </Text>
        <Box flexDirection="column" marginTop={0}>
          <Text color="subtle" dimColor>
            <Text color="tovyrPrimary" bold>{'> '}</Text>Try sending your message again
          </Text>
          <Text color="subtle" dimColor>
            <Text color="tovyrPrimary" bold>{'> '}</Text>Use <Text color="tovyrPrimary" bold>/model</Text> to switch providers
          </Text>
          <Text color="subtle" dimColor>
            <Text color="tovyrPrimary" bold>{'> '}</Text>Run <Text color="tovyrPrimary" bold>tovyr doctor</Text> for diagnostics
          </Text>
        </Box>
      </Box>
    </TovyrChatTurn>
  )
}
