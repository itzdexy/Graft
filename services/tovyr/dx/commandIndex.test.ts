import { describe, expect, test } from 'bun:test'
import type { Command } from '../../../types/command.js'
import {
  buildCommandIndex,
  paletteGroups,
  resolveCommandDiscoveryShortcuts,
  searchCommandIndex,
  shortcutGroups,
} from './commandIndex.js'

function command(name: string, description: string, category?: string): Command {
  return { name, description, category } as Command
}

describe('commandIndex', () => {
  test('does not advertise missing shortcuts', () => {
    const entries = buildCommandIndex([], {
      keybindings: ['ctrl+p', 'shift+tab', '?', 'esc'],
    })

    expect(entries.filter(entry => entry.kind === 'shortcut').map(entry => entry.keys)).toEqual([
      'ctrl+p',
      'shift+tab',
      '?',
      'esc',
    ])
  })

  test('uses the singular model command', () => {
    const entries = buildCommandIndex([
      command('model', 'Choose an active model'),
      command('models', 'Legacy selector'),
    ])

    expect(entries.some(entry => entry.name === '/models')).toBe(false)
    expect(entries.some(entry => entry.name === '/model')).toBe(true)
  })

  test('keeps palette, help, and hint projections on the same entries', () => {
    const entries = buildCommandIndex([
      command('plan', 'Draft a read-only plan'),
      command('model', 'Choose an active model'),
    ])

    expect(paletteGroups(entries).flatMap(group => group.entries)).toContainEqual(
      expect.objectContaining({ name: '/model' }),
    )
    expect(shortcutGroups(entries).flatMap(group => group.entries).map(entry => entry.keys).sort()).toEqual(
      entries.filter(entry => entry.kind === 'shortcut').map(entry => entry.keys).sort(),
    )
    expect(searchCommandIndex(entries, '/model')).toEqual([
      expect.objectContaining({ name: '/model' }),
    ])
  })

  test('projects the active resolver output, including Windows fallback and user overrides', () => {
    const windowsFallback = resolveCommandDiscoveryShortcuts({
      palette: 'ctrl+p',
      mode: 'meta+m',
      help: '?',
      dismiss: 'esc',
    })
    const override = resolveCommandDiscoveryShortcuts({
      palette: 'ctrl+space',
      mode: 'ctrl+shift+m',
      help: '?',
      dismiss: 'esc',
    })

    expect(windowsFallback.map(entry => entry.keys)).toContain('meta+m')
    expect(override.map(entry => entry.keys)).toContain('ctrl+space')
    expect(override.map(entry => entry.keys)).toContain('ctrl+shift+m')
  })
})
