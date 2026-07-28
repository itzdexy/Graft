import { describe, expect, test } from 'bun:test'
import { parseAgentArgs } from './AgentManager.js'

describe('parseAgentArgs', () => {
  test('parses verify command', () => {
    expect(parseAgentArgs('verify').command).toBe('verify')
  })

  test('parses autofix with goal', () => {
    const p = parseAgentArgs('autofix fix tests')
    expect(p.command).toBe('autofix')
    expect(p.autoFix).toBe(true)
    expect(p.goal).toBe('fix tests')
  })

  test('parses --autofix flag on start', () => {
    const p = parseAgentArgs('start --autofix add endpoint')
    expect(p.command).toBe('start')
    expect(p.autoFix).toBe(true)
    expect(p.goal).toBe('add endpoint')
  })

  test('parses timeline command', () => {
    expect(parseAgentArgs('timeline').command).toBe('timeline')
  })

  test('parses activity command', () => {
    expect(parseAgentArgs('activity').command).toBe('activity')
  })
})
