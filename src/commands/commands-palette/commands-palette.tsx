import * as React from 'react'
import type { Command, LocalJSXCommandContext } from '../../commands.js'
import { Pane } from '../../components/design-system/Pane.js'
import { FuzzyPicker } from '../../components/design-system/FuzzyPicker.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

const SUGGESTED_COMMANDS = ['welcome', 'dash', 'status', 'help', 'provider', 'model']

const CATEGORY_ORDER = ['Core', 'Build', 'Review', 'Memory', 'Settings', 'Help', 'Fun']

function categoryRank(cmd: Command): number {
  const cat = cmd.category ?? 'Other'
  const idx = CATEGORY_ORDER.indexOf(cat)
  return idx >= 0 ? idx : CATEGORY_ORDER.length
}

function compareCommands(a: Command, b: Command): number {
  const ra = categoryRank(a)
  const rb = categoryRank(b)
  if (ra !== rb) return ra - rb
  return a.name.localeCompare(b.name)
}

function commandMatches(query: string, cmd: Command): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    cmd.name.toLowerCase().includes(q) ||
    cmd.description.toLowerCase().includes(q) ||
    cmd.aliases?.some(a => a.toLowerCase().includes(q)) ||
    cmd.category?.toLowerCase().includes(q) ||
    false
  )
}

function CommandItem({ command, focused }: { command: Command; focused: boolean }): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={focused ? 'permission' : undefined} bold={focused}>
        /{command.name}
      </Text>
      <Text dimColor>· {command.description}</Text>
    </Box>
  )
}

function CommandPreview({ command }: { command: Command }): React.ReactNode {
  const aliases = command.aliases?.length
    ? ` (${command.aliases.map(a => `/${a}`).join(', ')})`
    : ''
  const hint = command.argumentHint ? ` ${command.argumentHint}` : ''
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="permission">
        /{command.name}
        {hint}
        {aliases}
      </Text>
      {command.category && (
        <Text dimColor marginTop={1}>
          Category: <Text color="permission">{command.category}</Text>
        </Text>
      )}
      <Text wrap="wrap" marginTop={1}>
        {command.description}
      </Text>
      {command.whenToUse && (
        <Text wrap="wrap" marginTop={1} dimColor>
          {command.whenToUse}
        </Text>
      )}
    </Box>
  )
}

function CommandPalette({
  sortedCommands,
  initialQuery,
  onDone,
}: {
  sortedCommands: Command[]
  initialQuery: string
  onDone: LocalJSXCommandOnDone
}) {
  const [query, setQuery] = React.useState(initialQuery)

  const filtered = React.useMemo(() => {
    const base = sortedCommands.filter(c => commandMatches(query, c))
    if (query) return base
    const suggested = SUGGESTED_COMMANDS.map(name =>
      sortedCommands.find(c => c.name === name),
    ).filter((c): c is Command => Boolean(c))
    const rest = base.filter(c => !SUGGESTED_COMMANDS.includes(c.name))
    return [...suggested, ...rest]
  }, [query, sortedCommands])

  const matchLabel = `${filtered.length} command${filtered.length === 1 ? '' : 's'}`

  return (
    <Pane color="permission">
      <FuzzyPicker<Command>
        title="Run a command:"
        placeholder="Type to filter commands…"
        initialQuery={initialQuery}
        items={filtered}
        getKey={cmd => cmd.name}
        renderItem={(cmd, focused) => <CommandItem command={cmd} focused={focused} />}
        renderPreview={cmd => <CommandPreview command={cmd} />}
        onQueryChange={setQuery}
        onSelect={cmd => {
          onDone(`/${cmd.name}`, { submitNextInput: true })
        }}
        onCancel={() => onDone('Command picker dismissed', { display: 'system' })}
        emptyMessage={q => `No commands match "${q}". Try /help for a full list.`}
        matchLabel={matchLabel}
        visibleCount={8}
      />
    </Pane>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  const allCommands = context.options.commands ?? []
  const visibleCommands = allCommands.filter(
    c =>
      !c.isHidden &&
      (c.type === 'local' ||
        c.type === 'local-jsx' ||
        (c.type === 'prompt' && c.userInvocable !== false)),
  )
  const sorted = [...visibleCommands].sort(compareCommands)

  return (
    <CommandPalette
      sortedCommands={sorted}
      initialQuery={args.trim()}
      onDone={onDone}
    />
  )
}
