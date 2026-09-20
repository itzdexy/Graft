import { describe, expect, test } from 'bun:test'
import type { Message } from '../../../types/message.js'
import {
  getGraftContextTokenCount,
  getGraftLiveTokenEstimate,
} from './tokenDisplay.js'

function assistantWithUsage(
  input: number,
  output: number,
  id = 'msg-1',
): Message {
  return {
    type: 'assistant',
    uuid: `uuid-${id}` as Message['uuid'],
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model: 'test',
      content: [{ type: 'text', text: 'hi' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: input,
        output_tokens: output,
      },
    },
  }
}

describe('tokenDisplay', () => {
  test('getGraftContextTokenCount sums latest usage', () => {
    const messages = [
      assistantWithUsage(100, 20, 'a'),
      assistantWithUsage(400, 80, 'b'),
    ]
    expect(getGraftContextTokenCount(messages)).toBe(480)
  })

  test('getGraftLiveTokenEstimate prefers API usage over char estimate', () => {
    const messages = [assistantWithUsage(1000, 200)]
    const ref = { current: 40 }
    expect(getGraftLiveTokenEstimate(messages, ref)).toBe(1210)
  })
})
