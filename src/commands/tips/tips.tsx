import * as React from 'react'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import { Pane } from '../../components/design-system/Pane.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { randomTovyrTip, TOVYR_TIPS } from '../../constants/tovyrTips.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  const tip = randomTovyrTip()
  onDone(tip)
  return (
    <Pane color="permission">
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="permission">Tovyr Tip ({TOVYR_TIPS.length} total)</Text>
        <Text wrap="wrap" marginTop={1}>{tip}</Text>
        <Text dimColor marginTop={1}>Run /tips again for another tip.</Text>
      </Box>
    </Pane>
  )
}
