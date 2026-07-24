import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import type { Command } from '../../commands.js'
import { getCommandName, isCommandEnabled } from '../../types/command.js'
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
  | { type: 'command'; command: Command }

export function getCommandCategory(cmd: Command): string {
  const name = getCommandName(cmd).toLowerCase()
  if (cmd.category) return cmd.category
  if (name === 'ask' || name === 'plan' || name === 'code' || name === 'fast' || name === 'btw') return 'Modes'
  if (name.includes('model')) return 'Models'
  if (name.includes('git')) return 'Git'
  if (name.includes('session') || name.includes('history')) return 'Session'
  if (name.includes('settings') || name.includes('config')) return 'Settings'
  if (name.includes('help') || name.includes('guide')) return 'Help'
  if (name.includes('explain') || name.includes('scan') || name.includes('project')) return 'Project'
  return 'Commands'
}

export function groupCommands(cmds: Command[]): CommandGroup[] {
  const byCategory = new Map<string, Command[]>()
  for (const cmd of cmds) {
    const cat = getCommandCategory(cmd)
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(cmd)
  }
  const order = ['Modes', 'Project', 'Models', 'Session', 'Git', 'Settings', 'Help', 'Commands']
  return order
    .map(name => ({ name, commands: byCategory.get(name) ?? [] }))
    .filter(g => g.commands.length > 0)
}

function buildFlatItems(grouped: CommandGroup[]): FlatItem[] {
  const items: FlatItem[] = []
  for (const g of grouped) {
    items.push({ type: 'header', name: g.name })
    for (const c of g.commands) {
      items.push({ type: 'command', command: c })
    }
  }
  return items
}

/** Searchable slash-command palette overlay with grouped categories. */
export const BlinkCommandPalette = memo(function BlinkCommandPalette({
  commands,
  onSelect,
  onClose,
}: Props): ReactNode {
  const { columns } = useTerminalSize()
  const [query, setQuery] = useState('/')
  const [selectedIndex, setSelectedIndex] = useState(1) // 0 is the search row

  const filtered = useMemo(() => {
    const q = query.replace(/^\//, '').toLowerCase().trim()
    const enabled = commands.filter(c => isCommandEnabled(c) && !c.isHidden)
    if (!q) return enabled
    return enabled.filter(c => {
      const name = getCommandName(c).toLowerCase()
      const desc = c.description.toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }, [commands, query])

  const grouped = useMemo(() => groupCommands(filtered.slice(0, MAX_VISIBLE)), [filtered])
  const flatItems = useMemo(() => buildFlatItems(grouped), [grouped])

  useEffect(() => {
    setSelectedIndex(1) // skip the first header if any
  }, [query])

  useInput(useCallback((key: any) => {
    if (key.escape) {
      onClose()
      return
    }
    if (key.return) {
      const selected = flatItems[selectedIndex]
      if (selected && selected.type === 'command') {
        onSelect(selected.command)
      }
      return
    }
    if (key.upArrow) {
      setSelectedIndex((i: number) => {
        let next = Math.max(0, i - 1)
        while (next > 0 && flatItems[next]?.type === 'header') {
          next = Math.max(0, next - 1)
        }
        return next
      })
      return
    }
    if (key.downArrow) {
      setSelectedIndex((i: number) => {
        let next = Math.min(flatItems.length - 1, i + 1)
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
    // Type to filter
    if (key.name && key.name.length === 1 && !key.ctrl && !key.meta) {
      setQuery((prev: string) => prev + key.name)
      return
    }
    if (key.name === 'backspace') {
      setQuery((prev: string) => prev.length > 1 ? prev.slice(0, -1) : prev)
    }
  }, [flatItems, selectedIndex, onSelect, onClose]))

  const width = Math.min(columns - SPACING.md, 70)

  return (
    <Centered maxWidth={74} minWidth={40} paddingX={2}>
      <Box flexDirection="column" width={width} paddingX={1} paddingY={1} borderStyle="round" borderColor="blinkPrimary">
        <Box flexDirection="row" marginBottom={1}>
          <Text color="blinkPrimary" bold>{'> '}</Text>
          <Text color="text">{query}</Text>
          <Text color="blinkPrimary">{'_'}</Text>
        </Box>
        <Box flexDirection="column">
          {filtered.length === 0 ? (
            <Text color="subtle" dimColor>No commands found</Text>
          ) : (
            flatItems.map((item, i) => {
              const isSelected = i === selectedIndex
              if (item.type === 'header') {
                return (
                  <Box key={item.name} marginTop={1} marginBottom={0}>
                    <Text color="subtle" dimColor bold>{item.name}</Text>
                  </Box>
                )
              }
              const cmd = item.command
              const name = getCommandName(cmd)
              const desc = truncateToWidth(cmd.description, width - name.length - 10)
              return (
                <Box key={name} flexDirection="row">
                  <Text color={isSelected ? 'blinkPrimary' : 'subtle'} bold={isSelected}>
                    {isSelected ? '› ' : '  '}
                  </Text>
                  <Text color={isSelected ? 'blinkPrimary' : 'text'} bold={isSelected}>
                    /{name}
                  </Text>
                  <Box flexGrow={1} />
                  <Text color="subtle" dimColor>{desc}</Text>
                </Box>
              )
            })
          )}
        </Box>
        <Box marginTop={1}>
          <Text color="subtle" dimColor>
            <Text color="blinkPrimary" bold>↑↓</Text> navigate{' · '}
            <Text color="blinkPrimary" bold>Enter</Text> select{' · '}
            <Text color="blinkPrimary" bold>Esc</Text> close
          </Text>
        </Box>
      </Box>
    </Centered>
  )
})
