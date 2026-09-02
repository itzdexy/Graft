// Special characters that macOS Option+key produces, mapped to their
// keybinding equivalents. Used to detect Option+key shortcuts on macOS
// terminals that don't have "Option as Meta" enabled.
export const MACOS_OPTION_SPECIAL_CHARS = {
  '†': 'alt+t', // Option+T -> thinking toggle
  π: 'alt+p', // Option+P -> model picker
  ø: 'alt+o', // Option+O -> fast mode
} as const satisfies Record<string, string>

export function isMacosOptionChar(
  char: string,
): char is keyof typeof MACOS_OPTION_SPECIAL_CHARS {
  return char in MACOS_OPTION_SPECIAL_CHARS
}

/**
 * Common keyboard shortcuts for quick reference and help display
 */
export const COMMON_SHORTCUTS = {
  // Navigation
  'ctrl+o': 'Toggle transcript mode',
  'ctrl+t': 'Toggle todo list',
  'ctrl+e': 'Toggle show all in transcript',
  'ctrl+c': 'Cancel / exit transcript',
  'escape': 'Cancel / exit',
  'tab': 'Next item',
  'shift+tab': 'Previous item',
  'enter': 'Confirm / select',
  'space': 'Expand / collapse',

  // Message navigation
  'ctrl+up': 'Scroll up',
  'ctrl+down': 'Scroll down',
  'ctrl+home': 'Go to top',
  'ctrl+end': 'Go to bottom',
  'ctrl+f': 'Search messages',

  // Editing
  'ctrl+k': 'Clear input',
  'ctrl+w': 'Delete word',
  'ctrl+u': 'Delete to start',
  'ctrl+a': 'Move to start',
  'ctrl+right': 'Move to end',

  // macOS alternatives
  'cmd+t': 'Toggle todo list (macOS)',
  'cmd+o': 'Toggle transcript (macOS)',
  'cmd+f': 'Search (macOS)',
} as const

/**
 * Get a human-readable description for a keyboard shortcut
 */
export function getShortcutDescription(shortcut: string): string {
  return COMMON_SHORTCUTS[shortcut as keyof typeof COMMON_SHORTCUTS] || ''
}

/**
 * Format a key for display (e.g., "ctrl+o" → "Ctrl+O")
 */
export function formatKeyForDisplay(key: string): string {
  return key
    .split('+')
    .map(part => {
      if (part === 'ctrl') return 'Ctrl'
      if (part === 'alt') return 'Alt'
      if (part === 'shift') return 'Shift'
      if (part === 'cmd') return 'Cmd'
      if (part === 'meta') return 'Meta'
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('+')
}
