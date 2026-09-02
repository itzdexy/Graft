import { describe, expect, test } from 'bun:test'
import { assertNormalizedRequest, PlatformRequestError } from './types.js'

describe('normalized platform request', () => {
  test('accepts a bounded text request with tools', () => {
    expect(assertNormalizedRequest({
      model: 'ollama::qwen2.5-coder:1.5b',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      tools: [{ name: 'Read', description: 'Read a file', inputSchema: { type: 'object' } }],
      stream: true,
    }).model).toBe('ollama::qwen2.5-coder:1.5b')
  })

  test('rejects an empty conversation', () => {
    expect(() => assertNormalizedRequest({ model: 'x', messages: [] })).toThrow(PlatformRequestError)
  })

  test('rejects a missing model', () => {
    expect(() => assertNormalizedRequest({ messages: [{ role: 'user', content: [] }] })).toThrow(PlatformRequestError)
  })

  test('rejects more than 256 messages and 128 tools', () => {
    const message = { role: 'user', content: [{ type: 'text', text: 'x' }] }
    expect(() => assertNormalizedRequest({ model: 'x', messages: Array.from({ length: 257 }, () => message) })).toThrow(PlatformRequestError)
    expect(() => assertNormalizedRequest({ model: 'x', messages: [message], tools: Array.from({ length: 129 }, () => ({ name: 'x', inputSchema: {} })) })).toThrow(PlatformRequestError)
  })
})
