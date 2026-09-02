import { describe, expect, test } from 'bun:test'
import {
  hasResolvedTovyrWebResult,
  resolveLocalClockToolName,
  selectTovyrRequestTools,
} from './requestTools.js'

describe('Tovyr request tool selection', () => {
  const tools = [
    { name: 'Read' },
    { name: 'WebFetch' },
    { name: 'WebSearch' },
    { name: 'TovyrWeb' },
  ]

  test('uses one unified web surface', () => {
    expect(selectTovyrRequestTools(tools, false).map(tool => tool.name)).toEqual([
      'Read',
      'TovyrWeb',
    ])
  })

  test('hides tools for casual conversation', () => {
    expect(selectTovyrRequestTools(tools, true)).toEqual([])
  })

  test('keeps TovyrWeb after search so read can follow in the same turn', () => {
    expect(
      hasResolvedTovyrWebResult([
        {
          message: {
            content: [
              {
                type: 'tool_result',
                content: '[TovyrWeb search]\n1. Example\nhttps://example.com',
              },
            ],
          },
        },
      ]),
    ).toBe(false)
    expect(selectTovyrRequestTools(tools, false, false).map(t => t.name)).toEqual([
      'Read',
      'TovyrWeb',
    ])
  })

  test('removes web tools after a successful read', () => {
    expect(selectTovyrRequestTools(tools, false, true)).toEqual([
      { name: 'Read' },
    ])
  })

  test('restricts contextual source follow-ups to one web call then prose', () => {
    expect(selectTovyrRequestTools(tools, false, false, true)).toEqual([
      { name: 'TovyrWeb' },
    ])
    expect(selectTovyrRequestTools(tools, false, true, true)).toEqual([])
  })

  test('keeps legacy tools when unified web is unavailable', () => {
    const legacy = tools.filter(tool => tool.name !== 'TovyrWeb')
    expect(selectTovyrRequestTools(legacy, false)).toBe(legacy)
  })

  test('recognizes a successful unified web read result', () => {
    expect(
      hasResolvedTovyrWebResult([
        {
          message: {
            content: [
              {
                type: 'tool_result',
                content: '[TovyrWeb read]\nInstallation instructions',
              },
            ],
          },
        },
      ]),
    ).toBe(true)
  })

  test('uses PowerShell for the Windows clock and Bash elsewhere', () => {
    const clockTools = [
      { name: 'Bash' },
      { name: 'PowerShell' },
      { name: 'TovyrWeb' },
    ]
    expect(resolveLocalClockToolName(clockTools, 'win32')).toBe('PowerShell')
    expect(resolveLocalClockToolName(clockTools, 'linux')).toBe('Bash')
    expect(resolveLocalClockToolName([{ name: 'TovyrWeb' }], 'win32')).toBeNull()
  })
})
