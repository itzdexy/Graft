import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'crypto'
import { blinkLastTurnNeedsSilentNotice } from './blinkSilentTurn.js'
import type { BlinkTranscriptContextValue } from './blinkTranscriptCollapse.js'

const emptyCtx: BlinkTranscriptContextValue = {
  hiddenDuplicateAssistantTextUuids: new Set(),
  hiddenToolUseIds: new Set(),
}

describe('blinkLastTurnNeedsSilentNotice', () => {
  test('returns false while loading', () => {
    const messages = [
      {
        type: 'user' as const,
        uuid: randomUUID(),
        message: { role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }] },
      },
    ]
    expect(blinkLastTurnNeedsSilentNotice(messages, emptyCtx, true)).toBe(false)
  })

  test('returns true after user turn with no assistant reply', () => {
    const messages = [
      {
        type: 'user' as const,
        uuid: randomUUID(),
        message: { role: 'user' as const, content: [{ type: 'text' as const, text: 'code a calculator' }] },
      },
      {
        type: 'system' as const,
        subtype: 'turn_duration' as const,
        durationMs: 30_000,
        uuid: randomUUID(),
        timestamp: new Date().toISOString(),
        isMeta: false,
      },
    ]
    expect(blinkLastTurnNeedsSilentNotice(messages, emptyCtx, false)).toBe(true)
  })

  test('returns false when assistant text is visible', () => {
    const messages = [
      {
        type: 'user' as const,
        uuid: randomUUID(),
        message: { role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }] },
      },
      {
        type: 'assistant' as const,
        uuid: randomUUID(),
        message: {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: 'Hello!' }],
        },
      },
    ]
    expect(blinkLastTurnNeedsSilentNotice(messages, emptyCtx, false)).toBe(false)
  })
})
