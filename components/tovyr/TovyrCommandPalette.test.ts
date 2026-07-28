import { describe, expect, test } from 'bun:test'
import type { Command } from '../../types/command.js'
import { getCommandCategory, groupCommands } from './TovyrCommandPalette.js'

function makeCommand(name: string, description: string, category?: string): Command {
  return {
    name,
    description,
    category,
  } as Command
}

describe('TovyrCommandPalette categorization', () => {
  test('categorizes modes by name', () => {
    expect(getCommandCategory(makeCommand('plan', 'Plan mode'))).toBe('Modes')
    expect(getCommandCategory(makeCommand('code', 'Code mode'))).toBe('Modes')
    expect(getCommandCategory(makeCommand('ask', 'Ask mode'))).toBe('Modes')
    expect(getCommandCategory(makeCommand('fast', 'Fast mode'))).toBe('Modes')
    expect(getCommandCategory(makeCommand('btw', 'BTW mode'))).toBe('Modes')
  })

  test('categorizes model and git commands', () => {
    expect(getCommandCategory(makeCommand('model', 'Switch model'))).toBe('Models')
    expect(getCommandCategory(makeCommand('git-status', 'Show git status'))).toBe('Git')
  })

  test('respects explicit category', () => {
    expect(getCommandCategory(makeCommand('custom', 'Custom', 'Custom Category'))).toBe('Custom Category')
  })

  test('groups commands in specified order', () => {
    const cmds = [
      makeCommand('git-status', 'Git'),
      makeCommand('model', 'Model'),
      makeCommand('plan', 'Plan'),
      makeCommand('unknown', 'Unknown'),
    ]
    const grouped = groupCommands(cmds)
    expect(grouped.map(g => g.name)).toEqual(['Modes', 'Models', 'Git', 'Commands'])
    expect(grouped[0].commands[0].name).toBe('plan')
  })
})
