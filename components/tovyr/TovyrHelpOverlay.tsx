import { memo, useCallback, type ReactNode } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'

type Props = {
  onClose: () => void
}

type ShortcutGroup = {
  title: string
  shortcuts: Array<{ keys: string; action: string }>
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'GENERAL',
    shortcuts: [
      { keys: 'Ctrl+P', action: 'Command palette' },
      { keys: 'Ctrl+O', action: 'Toggle transcript' },
      { keys: 'Ctrl+L', action: 'Redraw screen' },
      { keys: 'Ctrl+C', action: 'Cancel / exit' },
      { keys: '?', action: 'This help' },
      { keys: '/', action: 'Slash commands' },
    ],
  },
  {
    title: 'CHAT',
    shortcuts: [
      { keys: 'Enter', action: 'Send message' },
      { keys: 'Shift+Enter', action: 'New line' },
      { keys: 'Esc', action: 'Cancel generation' },
      { keys: 'PageUp/PageDn', action: 'Scroll conversation' },
      { keys: 'Up/Down', action: 'Command history' },
    ],
  },
  {
    title: 'MODES',
    shortcuts: [
      { keys: 'Tab', action: 'Switch agent/mode' },
      { keys: 'Shift+Tab', action: 'Cycle mode (Plan/Code/Ask)' },
      { keys: '/plan', action: 'Plan mode (read-only)' },
      { keys: '/code', action: 'Code mode (file edits)' },
      { keys: '/fast', action: 'Fast mode (reduced output)' },
      { keys: '/btw', action: 'Side question' },
    ],
  },
  {
    title: 'TOOLS',
    shortcuts: [
      { keys: 'Ctrl+R', action: 'Search history' },
      { keys: 'Ctrl+S', action: 'Stash prompt' },
      { keys: 'Ctrl+T', action: 'Toggle todos' },
      { keys: 'Ctrl+G', action: 'External editor' },
      { keys: '@file', action: 'Mention a file' },
    ],
  },
]

/** Keyboard shortcut help overlay. */
export const TovyrHelpOverlay = memo(function TovyrHelpOverlay({
  onClose,
}: Props): ReactNode {
  const { columns } = useTerminalSize()

  useInput(useCallback((_input: string, key: any) => {
    if (key.escape || key.name === '?' || key.return) {
      onClose()
    }
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
          {GROUPS.map((group, gi) => (
            <Box key={gi} flexDirection="column" width={colWidth} marginRight={2} marginBottom={1}>
              <Text color="tovyrSecondary" bold>{group.title}</Text>
              {group.shortcuts.map((sc, i) => (
                <Box key={i} flexDirection="row" gap={1}>
                  <Text color="tovyrPrimary" bold>
                    {sc.keys.padEnd(16, ' ')}
                  </Text>
                  <Text color="text" dimColor>{sc.action}</Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
})
