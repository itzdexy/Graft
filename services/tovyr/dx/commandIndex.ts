import { useMemo } from 'react'
import { useOptionalKeybindingContext } from '../../../keybindings/KeybindingContext.js'
import type { Command } from '../../../types/command.js'
import { getCommandName, isCommandEnabled } from '../../../types/command.js'

export type CommandIndexCategory =
  | 'Coding'
  | 'Context'
  | 'Models'
  | 'Sessions'
  | 'Tools'
  | 'Settings'
  | 'Help'

export type CommandIndexEntry = {
  kind: 'command' | 'shortcut'
  name: string
  description: string
  category: CommandIndexCategory
  keys?: string
  command?: Command
}

export type CommandIndexGroup = {
  name: CommandIndexCategory
  entries: CommandIndexEntry[]
}

export type ImplementedKeybinding = {
  keys: string
  description: string
  category: CommandIndexCategory
}

export type CommandDiscoveryShortcutValues = {
  palette?: string
  mode?: string
  help?: string
  dismiss?: string
}

const CATEGORY_ORDER: readonly CommandIndexCategory[] = [
  'Coding',
  'Context',
  'Models',
  'Sessions',
  'Tools',
  'Settings',
  'Help',
]

/**
 * Turns the active keybinding resolver's display values into the few shortcuts
 * that make sense while the composer owns focus. The fallback object is used
 * only outside a KeybindingProvider (for pure/index tests); renderers call the
 * hook below and therefore reflect platform fallbacks and user overrides.
 */
export function resolveCommandDiscoveryShortcuts(
  values: CommandDiscoveryShortcutValues,
): readonly ImplementedKeybinding[] {
  return [
    [values.palette, 'commands', 'Tools'],
    [values.mode, 'mode', 'Coding'],
    [values.help, 'help', 'Help'],
    [values.dismiss, 'interrupt', 'Help'],
  ].flatMap(([keys, description, category]) =>
    keys ? [{ keys, description, category: category as CommandIndexCategory }] : [],
  )
}

/** Default only for non-rendering callers; the UI uses the active resolver. */
export const IMPLEMENTED_KEYBINDINGS = resolveCommandDiscoveryShortcuts({
  palette: 'ctrl+p',
  mode: 'shift+tab',
  help: '?',
  dismiss: 'esc',
})

/**
 * Uses the established keybinding provider rather than duplicating key lookup.
 * In particular, Windows terminals that cannot deliver Shift+Tab resolve to
 * the runtime's `meta+m` fallback, a user keybindings.json override wins, and
 * an explicit null-unbind is omitted from discovery.
 */
export function useResolvedCommandDiscoveryShortcuts(): readonly ImplementedKeybinding[] {
  const keybindings = useOptionalKeybindingContext()
  const palette = keybindings
    ? keybindings.getDisplayText('app:commandPalette', 'Global')
    : 'ctrl+p'
  const mode = keybindings
    ? keybindings.getDisplayText('chat:cycleMode', 'Chat')
    : 'shift+tab'
  const help = keybindings
    ? keybindings.getDisplayText('app:toggleHelp', 'Global')
    : '?'
  const dismiss = keybindings
    ? keybindings.getDisplayText('help:dismiss', 'Help')
    : 'esc'

  return useMemo(
    () => resolveCommandDiscoveryShortcuts({ palette, mode, help, dismiss }),
    [palette, mode, help, dismiss],
  )
}

/** Builds the full command and shortcut index from the active runtime state. */
export function useTovyrCommandIndex(
  commands: readonly Command[],
): CommandIndexEntry[] {
  const keybindings = useResolvedCommandDiscoveryShortcuts()
  return useMemo(
    () => buildCommandIndex(commands, { keybindings }),
    [commands, keybindings],
  )
}

export type BuildCommandIndexOptions = {
  /**
   * The bindings available in the current surface. Supplying this list is how
   * an embedding deliberately narrows help instead of inheriting defaults.
   */
  keybindings?: readonly (string | ImplementedKeybinding)[]
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase()
}

function commandCategory(command: Command): CommandIndexCategory {
  const name = getCommandName(command).toLowerCase()
  const declared = command.category?.toLowerCase()

  if (declared === 'help' || /help|guide/.test(name)) return 'Help'
  if (declared === 'settings' || /config|setting|permission|theme|color|init|keybinding/.test(name)) return 'Settings'
  if (/git/.test(name)) return 'Tools'
  if (declared === 'memory' || /context|memory|compact|status|cost/.test(name)) return 'Context'
  if (/model|provider/.test(name)) return 'Models'
  if (/session|resume|history|rename|fork/.test(name)) return 'Sessions'
  if (declared === 'review' || /tool|skill|mcp|doctor|diff|terminal/.test(name)) return 'Tools'
  return 'Coding'
}

function shortcutFor(key: string): ImplementedKeybinding {
  const normalized = normalizeKey(key)
  return (
    IMPLEMENTED_KEYBINDINGS.find(binding => binding.keys === normalized) ?? {
      keys: normalized,
      description: 'Shortcut',
      category: 'Tools',
    }
  )
}

function commandEntry(command: Command): CommandIndexEntry | null {
  if (!isCommandEnabled(command) || command.isHidden) return null

  const name = getCommandName(command)
  // `/models` was an old spelling. The runtime command is singular and keeps
  // the old spelling only as a compatibility alias, never as discovery copy.
  if (name.toLowerCase() === 'models') return null

  return {
    kind: 'command',
    name: `/${name}`,
    description: command.description,
    category: commandCategory(command),
    command,
  }
}

/** Builds the one discovery source for the palette, help, and footer rail. */
export function buildCommandIndex(
  commands: readonly Command[],
  options: BuildCommandIndexOptions = {},
): CommandIndexEntry[] {
  const commandsByName = new Set<string>()
  const commandEntries = commands.flatMap(command => {
    const entry = commandEntry(command)
    if (!entry || commandsByName.has(entry.name.toLowerCase())) return []
    commandsByName.add(entry.name.toLowerCase())
    return [entry]
  })

  const requestedBindings = options.keybindings ?? IMPLEMENTED_KEYBINDINGS
  const shortcutKeys = new Set<string>()
  const shortcutEntries = requestedBindings.flatMap(binding => {
    const resolved = typeof binding === 'string' ? shortcutFor(binding) : binding
    const keys = normalizeKey(resolved.keys)
    if (!keys || shortcutKeys.has(keys)) return []
    shortcutKeys.add(keys)
    return [{
      kind: 'shortcut' as const,
      name: keys,
      description: resolved.description,
      category: resolved.category,
      keys,
    }]
  })

  return [...commandEntries, ...shortcutEntries]
}

function groupsFor(
  entries: readonly CommandIndexEntry[],
  predicate: (entry: CommandIndexEntry) => boolean,
): CommandIndexGroup[] {
  const groups = new Map<CommandIndexCategory, CommandIndexEntry[]>()
  for (const entry of entries) {
    if (!predicate(entry)) continue
    const group = groups.get(entry.category) ?? []
    group.push(entry)
    groups.set(entry.category, group)
  }
  return CATEGORY_ORDER.flatMap(name => {
    const entries = groups.get(name)
    return entries?.length ? [{ name, entries }] : []
  })
}

export function paletteGroups(entries: readonly CommandIndexEntry[]): CommandIndexGroup[] {
  return groupsFor(entries, entry => entry.kind === 'command')
}

export function shortcutGroups(entries: readonly CommandIndexEntry[]): CommandIndexGroup[] {
  return groupsFor(entries, entry => entry.kind === 'shortcut')
}

export function searchCommandIndex(
  entries: readonly CommandIndexEntry[],
  query: string,
): CommandIndexEntry[] {
  const needle = query.replace(/^\//, '').trim().toLowerCase()
  if (!needle) return [...entries]
  return entries.filter(entry => {
    const aliases = entry.command?.aliases?.join(' ') ?? ''
    return `${entry.name} ${entry.description} ${entry.category} ${aliases}`
      .toLowerCase()
      .includes(needle)
  })
}
