import { describe, expect, test } from 'bun:test'
import {
  hasResolvedGraftWebResult,
  resolveLocalClockToolName,
  selectGraftRequestTools,
} from './requestTools.js'

describe('Graft request tool selection', () => {
  const tools = [
    { name: 'Read' },
    { name: 'WebFetch' },
    { name: 'WebSearch' },
    { name: 'GraftWeb' },
  ]

  test('uses one unified web surface', () => {
    expect(selectGraftRequestTools(tools, false).map(tool => tool.name)).toEqual([
      'Read',
      'GraftWeb',
    ])
  })

  test('hides tools for casual conversation', () => {
    expect(selectGraftRequestTools(tools, true)).toEqual([])
  })

  test('keeps GraftWeb after search so read can follow in the same turn', () => {
    expect(
      hasResolvedGraftWebResult([
        {
          message: {
            content: [
              {
                type: 'tool_result',
                content: '[GraftWeb search]\n1. Example\nhttps://example.com',
              },
            ],
          },
        },
      ]),
    ).toBe(false)
    expect(selectGraftRequestTools(tools, false, false).map(t => t.name)).toEqual([
      'Read',
      'GraftWeb',
    ])
  })

  test('removes web tools after a successful read', () => {
    expect(selectGraftRequestTools(tools, false, true)).toEqual([
      { name: 'Read' },
    ])
  })

  test('restricts contextual source follow-ups to one web call then prose', () => {
    expect(selectGraftRequestTools(tools, false, false, true)).toEqual([
      { name: 'GraftWeb' },
    ])
    expect(selectGraftRequestTools(tools, false, true, true)).toEqual([])
  })

  test('keeps legacy tools when unified web is unavailable', () => {
    const legacy = tools.filter(tool => tool.name !== 'GraftWeb')
    expect(selectGraftRequestTools(legacy, false)).toBe(legacy)
  })

  test('recognizes a successful unified web read result', () => {
    expect(
      hasResolvedGraftWebResult([
        {
          message: {
            content: [
              {
                type: 'tool_result',
                content: '[GraftWeb read]\nInstallation instructions',
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
      { name: 'GraftWeb' },
    ]
    expect(resolveLocalClockToolName(clockTools, 'win32')).toBe('PowerShell')
    expect(resolveLocalClockToolName(clockTools, 'linux')).toBe('Bash')
    expect(resolveLocalClockToolName([{ name: 'GraftWeb' }], 'win32')).toBeNull()
  })
})
