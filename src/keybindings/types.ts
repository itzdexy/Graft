/**
 * Keybinding action name (e.g., 'app:toggleTodos', 'chat:submit').
 * Actions are open-ended strings so plugins/user configs can define new ones.
 */
export type KeybindingAction = string

/**
 * Valid context names where keybindings can be applied.
 * Must stay in sync with KEYBINDING_CONTEXTS in keybindings/schema.ts and
 * VALID_CONTEXTS in keybindings/validate.ts.
 */
export type KeybindingContextName =
  | 'Global'
  | 'Chat'
  | 'Autocomplete'
  | 'Confirmation'
  | 'Help'
  | 'Transcript'
  | 'HistorySearch'
  | 'Task'
  | 'ThemePicker'
  | 'Settings'
  | 'Tabs'
  | 'Attachments'
  | 'Footer'
  | 'MessageSelector'
  | 'DiffDialog'
  | 'ModelPicker'
  | 'Select'
  | 'Plugin'
  | 'Scroll'
  | 'MessageActions'

/**
 * A single parsed keystroke with normalized modifier flags.
 */
export type ParsedKeystroke = {
  /** Normalized key name (e.g., 'escape', 'enter', 'up', 'a', ' ') */
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  super: boolean
}

/**
 * A chord is a sequence of keystrokes (e.g., "ctrl+x ctrl+k" has two).
 */
export type Chord = ParsedKeystroke[]

/**
 * A block of bindings from a keybindings.json config file,
 * scoped to a single context.
 */
export type KeybindingBlock = {
  context: KeybindingContextName
  /** Map of keystroke string (e.g., "ctrl+k") to action, or null to unbind */
  bindings: Record<string, string | null>
}

/**
 * A fully parsed binding ready for matching/resolution.
 */
export type ParsedBinding = {
  chord: Chord
  /** Action to invoke, or null if explicitly unbound */
  action: string | null
  context: KeybindingContextName
}
