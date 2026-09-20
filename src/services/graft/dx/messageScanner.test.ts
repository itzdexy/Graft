import { describe, expect, test } from 'bun:test'
import { extractRecentToolUses, getLastToolLabel } from './messageScanner.js'

describe('extractRecentToolUses', () => {
  test('collects tool_use blocks from assistant messages', () => {
    const messages = [
      {
        type: 'user',
        message: { content: 'hi' },
      },
      {
        type: 'assistant',
        timestamp: '2024-01-01T12:00:00.000Z',
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: 'a.ts' } },
            { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } },
          ],
        },
      },
    ]
    const tools = extractRecentToolUses(messages)
    expect(tools).toHaveLength(2)
    expect(tools[0]!.name).toBe('Read')
    expect(tools[0]!.summary).toBe('a.ts')
    expect(tools[1]!.name).toBe('Bash')
  })
})

describe('getLastToolLabel', () => {
  test('returns formatted last tool', () => {
    const label = getLastToolLabel([
      {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', name: 'Grep', input: { pattern: 'foo' } }],
        },
      },
    ])
    expect(label).toBe('Grep: foo')
  })

  test('returns null when no tools', () => {
    expect(getLastToolLabel([])).toBeNull()
  })
})
