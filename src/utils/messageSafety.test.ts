import { test, expect } from 'bun:test'
import { normalizeMessagesForAPI } from './messages.js'
import { applyGrouping } from './groupToolUses.js'
import { FRAME_INTERVAL_MS } from '../ink/constants.js'

test('FRAME_INTERVAL_MS is configured for 120 FPS target (8ms)', () => {
  expect(FRAME_INTERVAL_MS).toBe(8)
})

test('applyGrouping handles user messages with string content safely without throwing', () => {
  const userMsgWithStringContent = {
    type: 'user' as const,
    uuid: 'msg-1',
    timestamp: Date.now(),
    message: {
      role: 'user' as const,
      content: 'Hello, make me a website on E:\\' as unknown as string,
    },
  }

  expect(() => {
    // Should not throw (msg.message?.content ?? []).filter is not a function
    const result = applyGrouping([userMsgWithStringContent as any], [])
    expect(result.messages.length).toBe(1)
  }).not.toThrow()
})

test('normalizeMessagesForAPI handles assistant and user messages with string content safely', () => {
  const messages = [
    {
      type: 'user' as const,
      uuid: 'msg-1',
      timestamp: Date.now(),
      message: {
        role: 'user' as const,
        content: 'hi',
      },
    },
    {
      type: 'assistant' as const,
      uuid: 'msg-2',
      timestamp: Date.now(),
      message: {
        role: 'assistant' as const,
        content: 'Hi! Ready to help you.',
      },
    },
  ]

  expect(() => {
    const normalized = normalizeMessagesForAPI(messages as any)
    expect(normalized).toBeDefined()
  }).not.toThrow()
})
