import { describe, expect, test } from 'bun:test'
import { isSilentTurn } from './silentTurn.js'

const prompt = (text: string) => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'text', text }] },
})

const reply = (text: string) => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text }] },
})

const toolUse = () => ({
  type: 'assistant',
  message: {
    role: 'assistant',
    content: [{ type: 'tool_use', id: 't1', name: 'Glob', input: {} }],
  },
})

const toolResult = () => ({
  type: 'user',
  message: {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }],
  },
})

const thinkingOnly = () => ({
  type: 'assistant',
  message: {
    role: 'assistant',
    content: [{ type: 'thinking', thinking: 'pondering' }],
  },
})

const base = { isLoading: false, inProgressToolCount: 0 }

describe('isSilentTurn', () => {
  test('flags a turn that ends on a tool result with no reply', () => {
    expect(
      isSilentTurn({
        ...base,
        messages: [prompt('build me a dashboard'), toolUse(), toolResult()],
      }),
    ).toBe(true)
  })

  test('flags a turn that produced only reasoning', () => {
    expect(
      isSilentTurn({
        ...base,
        messages: [prompt('build me a dashboard'), thinkingOnly()],
      }),
    ).toBe(true)
  })

  test('stays quiet when the assistant actually replied', () => {
    expect(
      isSilentTurn({
        ...base,
        messages: [prompt('hi'), toolUse(), toolResult(), reply('done')],
      }),
    ).toBe(false)
  })

  test('stays quiet while the turn is still streaming', () => {
    expect(
      isSilentTurn({
        ...base,
        isLoading: true,
        messages: [prompt('hi'), toolUse()],
      }),
    ).toBe(false)
  })

  test('stays quiet while a tool is still running', () => {
    expect(
      isSilentTurn({
        ...base,
        inProgressToolCount: 1,
        messages: [prompt('hi'), toolUse()],
      }),
    ).toBe(false)
  })

  test('stays quiet when a system notice already explained the failure', () => {
    expect(
      isSilentTurn({
        ...base,
        messages: [
          prompt('hi'),
          { type: 'system', message: { content: 'API error' } },
        ],
      }),
    ).toBe(false)
  })

  test('stays quiet before the turn has produced anything', () => {
    expect(isSilentTurn({ ...base, messages: [prompt('hi')] })).toBe(false)
  })

  test('whitespace-only reply does not count as an answer', () => {
    expect(
      isSilentTurn({ ...base, messages: [prompt('hi'), reply('   \n  ')] }),
    ).toBe(true)
  })

  test('ignores meta user messages when finding the prompt', () => {
    expect(
      isSilentTurn({
        ...base,
        messages: [
          prompt('real prompt'),
          { type: 'user', isMeta: true, message: { content: 'injected' } },
          toolUse(),
          toolResult(),
        ],
      }),
    ).toBe(true)
  })

  test('returns false with no human prompt at all', () => {
    expect(isSilentTurn({ ...base, messages: [reply('orphan')] })).toBe(false)
  })
})
