import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { getAgentHelpBlurb } from '../../utils/tovyrBrand.js'
import { getActiveProviderId, loadState } from '../../../scripts/tovyr-providers.js'
import { PromptInputHelpMenu } from '../PromptInput/PromptInputHelpMenu.js'

function QuickStartHints(): React.ReactNode {
  let providerHint: React.ReactNode = null
  try {
    const state = loadState()
    const provider = getActiveProviderId(state)
    if (!provider) {
      providerHint = (
        <Text dimColor>
          No provider set. Run <Text color="permission">/provider</Text> to choose one.
        </Text>
      )
    }
  } catch {
    // ignore
  }

  return (
    <Box flexDirection="column" gap={1}>
      {providerHint}
      <Text dimColor>
        First time here? Run <Text color="permission">/welcome</Text> for a quick tour.
      </Text>
      <Text dimColor>
        Stuck? Run <Text color="permission">/commands</Text> to search every command.
      </Text>
    </Box>
  )
}

export function General(): React.ReactNode {
  return (
    <Box flexDirection="column" paddingY={1} gap={1}>
      <Box>
        <Text>{getAgentHelpBlurb()}</Text>
      </Box>
      <QuickStartHints />
      <Box flexDirection="column">
        <Box>
          <Text bold>Shortcuts</Text>
        </Box>
        <PromptInputHelpMenu gap={2} fixedWidth={true} />
      </Box>
    </Box>
  )
}
