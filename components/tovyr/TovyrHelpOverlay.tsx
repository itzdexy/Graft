import { memo, type ReactNode } from 'react'
import type { Command } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import {
  shortcutGroups,
  useTovyrCommandIndex,
} from '../../services/tovyr/dx/commandIndex.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { useRegisterKeybindingContext } from '../../keybindings/KeybindingContext.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'

type Props = {
  onClose: () => void
  /** Runtime commands are accepted so this overlay shares the same index as the palette. */
  commands?: readonly Command[]
}

/** Keyboard shortcut help overlay, projected from the command index. */
export const TovyrHelpOverlay = memo(function TovyrHelpOverlay({
  onClose,
  commands = [],
}: Props): ReactNode {
  const { columns } = useTerminalSize()
  const groups = shortcutGroups(useTovyrCommandIndex(commands))
  useRegisterKeybindingContext('Help')
  useKeybindings(
    {
      'help:dismiss': onClose,
      'help:toggle': onClose,
    },
    { context: 'Help' },
  )

  const colWidth = Math.min(Math.floor((columns - 8) / 2), 36)
  const modalWidth = Math.min(columns - 4, 78)

  return (
    <Box flexDirection="column" alignItems="center" width={columns}>
      <Box flexDirection="column" width={modalWidth} paddingX={1} paddingY={1} borderStyle="round" borderColor="tovyrPrimary">
        <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
          <Text color="tovyrPrimary" bold>Keyboard Shortcuts</Text>
          <Text color="subtle" dimColor>Esc to close</Text>
        </Box>
        <Box flexDirection="row" flexWrap="wrap">
          {groups.map(group => (
            <Box key={group.name} flexDirection="column" width={colWidth} marginRight={2} marginBottom={1}>
              <Text color="tovyrSecondary" bold>{group.name.toUpperCase()}</Text>
              {group.entries.map(shortcut => (
                <Box key={shortcut.keys} flexDirection="row" gap={1}>
                  <Text color="tovyrPrimary" bold>{(shortcut.keys ?? '').padEnd(16, ' ')}</Text>
                  <Text color="text" dimColor>{shortcut.description}</Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
})
