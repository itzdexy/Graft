import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Command } from '../../commands.js'
import { Box, Text, useInput } from '../../ink.js'
import {
  buildCommandIndex,
  paletteGroups,
  searchCommandIndex,
  type CommandIndexEntry,
} from '../../services/tovyr/dx/commandIndex.js'
import { getCommandName } from '../../types/command.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { truncateToWidth } from '../../utils/format.js'
import { Centered } from '../design-system/Centered.js'
import { SPACING } from '../design-system/spacing.js'

type Props = {
  commands: Command[]
  onSelect: (cmd: Command) => void
  onClose: () => void
}

const MAX_VISIBLE = 14

type CommandGroup = {
  name: string
  commands: Command[]
}

type FlatItem =
  | { type: 'header'; name: string }
  | { type: 'command'; entry: CommandIndexEntry & { command: Command } }

/** Compatibility helpers for callers that previously consumed palette grouping. */
export function getCommandCategory(cmd: Command): string {
  return paletteGroups(buildCommandIndex([cmd], { keybindings: [] }))[0]?.name ?? 'Coding'
}

export function groupCommands(cmds: Command[]): CommandGroup[] {
  return paletteGroups(buildCommandIndex(cmds, { keybindings: [] })).map(group => ({
    name: group.name,
    commands: group.entries.flatMap(entry => (entry.command ? [entry.command] : [])),
  }))
}

function buildFlatItems(entries: CommandIndexEntry[]): FlatItem[] {
  const items: FlatItem[] = []
  for (const group of paletteGroups(entries)) {
    items.push({ type: 'header', name: group.name })
    for (const entry of group.entries) {
      if (entry.command) {
        items.push({
          type: 'command',
          entry: entry as CommandIndexEntry & { command: Command },
        })
      }
    }
  }
  return items
}

/** Searchable slash-command palette overlay with index-derived groups. */
export const TovyrCommandPalette = memo(function TovyrCommandPalette({
  commands,
  onSelect,
  onClose,
}: Props): ReactNode {
  const { columns } = useTerminalSize()
  const [query, setQuery] = useState('/')
  const [selectedIndex, setSelectedIndex] = useState(1) // 0 is the search row

  const entries = useMemo(
    () => buildCommandIndex(commands, { keybindings: [] }),
    [commands],
  )
  const filtered = useMemo(
    () => searchCommandIndex(entries, query).filter(entry => entry.kind === 'command'),
    [entries, query],
  )
  const flatItems = useMemo(
    () => buildFlatItems(filtered.slice(0, MAX_VISIBLE)),
    [filtered],
  )

  useEffect(() => {
    setSelectedIndex(1) // skip the first header if any
  }, [query])

  useInput(useCallback((_input: string, key: any) => {
    if (key.escape) {
      onClose()
      return
    }
    if (key.return) {
      const selected = flatItems[selectedIndex]
      if (selected?.type === 'command') onSelect(selected.entry.command)
      return
    }
    if (key.upArrow) {
      setSelectedIndex((index: number) => {
        let next = Math.max(0, index - 1)
        while (next > 0 && flatItems[next]?.type === 'header') {
          next = Math.max(0, next - 1)
        }
        return next
      })
      return
    }
    if (key.downArrow) {
      setSelectedIndex((index: number) => {
        let next = Math.min(flatItems.length - 1, index + 1)
        while (next < flatItems.length - 1 && flatItems[next]?.type === 'header') {
          next = Math.min(flatItems.length - 1, next + 1)
        }
        return next
      })
      return
    }
    if (key.ctrl && key.name === 'c') {
      onClose()
      return
    }
    if (key.name && key.name.length === 1 && !key.ctrl && !key.meta) {
      setQuery((previous: string) => previous + key.name)
      return
    }
    if (key.name === 'backspace') {
      setQuery((previous: string) => previous.length > 1 ? previous.slice(0, -1) : previous)
    }
  }, [flatItems, selectedIndex, onSelect, onClose]))

  const width = Math.min(columns - SPACING.md, 70)

  return (
    <Centered maxWidth={74} minWidth={40} paddingX={2}>
      <Box flexDirection="column" width={width} paddingX={1} paddingY={1} borderStyle="round" borderColor="tovyrPrimary">
        <Box flexDirection="row" marginBottom={1}>
          <Text color="tovyrPrimary" bold>{'> '}</Text>
          <Text color="text">{query}</Text>
          <Text color="tovyrPrimary">{'_'}</Text>
        </Box>
        <Box flexDirection="column">
          {filtered.length === 0 ? (
            <Text color="subtle" dimColor>No commands found</Text>
          ) : flatItems.map((item, index) => {
            const isSelected = index === selectedIndex
            if (item.type === 'header') {
              return <Box key={item.name} marginTop={1} marginBottom={0}><Text color="subtle" dimColor bold>{item.name}</Text></Box>
            }
            const name = getCommandName(item.entry.command)
            const description = truncateToWidth(item.entry.description, width - name.length - 10)
            return (
              <Box key={item.entry.name} flexDirection="row">
                <Text color={isSelected ? 'tovyrPrimary' : 'subtle'} bold={isSelected}>{isSelected ? '› ' : '  '}</Text>
                <Text color={isSelected ? 'tovyrPrimary' : 'text'} bold={isSelected}>/{name}</Text>
                <Box flexGrow={1} />
                <Text color="subtle" dimColor>{description}</Text>
              </Box>
            )
          })}
        </Box>
        <Box marginTop={1}>
          <Text color="subtle" dimColor><Text color="tovyrPrimary" bold>↑↓</Text> navigate{' · '}<Text color="tovyrPrimary" bold>Enter</Text> select{' · '}<Text color="tovyrPrimary" bold>Esc</Text> close</Text>
        </Box>
      </Box>
    </Centered>
  )
})
