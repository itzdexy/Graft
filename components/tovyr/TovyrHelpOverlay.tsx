import { memo, useCallback, useMemo, type ReactNode } from 'react'
import type { Command } from '../../commands.js'
import { Box, Text, useInput } from '../../ink.js'
import {
  buildCommandIndex,
  shortcutGroups,
  type BuildCommandIndexOptions,
} from '../../services/tovyr/dx/commandIndex.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'

type Props = {
  onClose: () => void
  /** Runtime commands are accepted so this overlay shares the same index as the palette. */
  commands?: readonly Command[]
  keybindings?: BuildCommandIndexOptions['keybindings']
}

/** Keyboard shortcut help overlay, projected from the command index. */
export const TovyrHelpOverlay = memo(function TovyrHelpOverlay({
  onClose,
  commands = [],
  keybindings,
}: Props): ReactNode {
  const { columns } = useTerminalSize()
  const groups = useMemo(
    () => shortcutGroups(buildCommandIndex(commands, { keybindings })),
    [commands, keybindings],
  )

  useInput(useCallback((_input: string, key: any) => {
    if (key.escape || key.name === '?' || key.return) onClose()
  }, [onClose]))

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
