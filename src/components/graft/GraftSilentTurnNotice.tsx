import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { GraftChatTurn } from './GraftChatTurn.js'

/** Shown when a turn completes with no visible assistant reply in scrollback. */
export function GraftSilentTurnNotice(): ReactNode {
  return (
    <GraftChatTurn role="graft" addMargin={false}>
      <Box flexDirection="column">
        <Text color="warning" dimColor wrap="wrap">
          <Text color="warning" bold>{'! '}</Text>
          Graft finished without a visible reply. The model may have returned an empty
          response.
        </Text>
        <Box flexDirection="column" marginTop={0}>
          <Text color="subtle" dimColor>
            <Text color="graftPrimary" bold>{'> '}</Text>Try sending your message again
          </Text>
          <Text color="subtle" dimColor>
            <Text color="graftPrimary" bold>{'> '}</Text>Use <Text color="graftPrimary" bold>/model</Text> to switch providers
          </Text>
          <Text color="subtle" dimColor>
            <Text color="graftPrimary" bold>{'> '}</Text>Run <Text color="graftPrimary" bold>graft doctor</Text> for diagnostics
          </Text>
        </Box>
      </Box>
    </GraftChatTurn>
  )
}
