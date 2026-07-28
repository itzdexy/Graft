import { describe, expect, test } from 'bun:test'
import {
  CHROME_NATIVE_MAX_MESSAGE_SIZE,
  decodeAllLengthPrefixedMessages,
  decodeOneLengthPrefixedMessage,
  encodeLengthPrefixedMessage,
  isValidFrameLength,
} from '../../../utils/claudeInChrome/nativeMessagingFraming.js'

describe('nativeMessagingFraming', () => {
  test('encode/decode round-trip', () => {
    const payload = '{"type":"ping"}'
    const frame = encodeLengthPrefixedMessage(payload)
    const decoded = decodeOneLengthPrefixedMessage(frame)
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.message).toBe(payload)
      expect(decoded.remainder.length).toBe(0)
    }
  })

  test('rejects zero and oversized lengths', () => {
    expect(isValidFrameLength(0)).toBe(false)
    expect(isValidFrameLength(CHROME_NATIVE_MAX_MESSAGE_SIZE + 1)).toBe(false)
    expect(isValidFrameLength(12)).toBe(true)
  })

  test('encode throws when payload exceeds max', () => {
    const huge = 'x'.repeat(CHROME_NATIVE_MAX_MESSAGE_SIZE + 1)
    expect(() => encodeLengthPrefixedMessage(huge)).toThrow(/exceeds max size/)
  })

  test('incremental decode leaves partial tail', () => {
    const a = encodeLengthPrefixedMessage('{"a":1}')
    const b = encodeLengthPrefixedMessage('{"b":2}')
    const partial = Buffer.concat([a, b.subarray(0, 6)])
    const first = decodeOneLengthPrefixedMessage(partial)
    expect(first.ok).toBe(true)
    if (first.ok) {
      expect(first.message).toBe('{"a":1}')
      expect(first.remainder.length).toBe(6)
      const second = decodeOneLengthPrefixedMessage(first.remainder)
      expect(second.ok).toBe(false)
      if (!second.ok) {
        expect(second.reason).toBe('incomplete')
      }
    }
  })

  test('decodeAll drains multiple frames', () => {
    const buf = Buffer.concat([
      encodeLengthPrefixedMessage('one'),
      encodeLengthPrefixedMessage('two'),
    ])
    const drained = decodeAllLengthPrefixedMessages(buf)
    expect(drained.invalidLength).toBe(false)
    expect(drained.messages).toEqual(['one', 'two'])
    expect(drained.remainder.length).toBe(0)
  })

  test('decodeAll flags invalid length', () => {
    const bad = Buffer.alloc(8)
    bad.writeUInt32LE(0, 0)
    const drained = decodeAllLengthPrefixedMessages(bad)
    expect(drained.invalidLength).toBe(true)
  })
})