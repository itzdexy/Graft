/**
 * Length-prefixed framing for Chrome native messaging and MCP socket bridge.
 * Chrome protocol: 4-byte little-endian length + UTF-8 JSON payload.
 */

export const CHROME_NATIVE_MAX_MESSAGE_SIZE = 1024 * 1024 // 1MB

export function isValidFrameLength(
  length: number,
  maxSize = CHROME_NATIVE_MAX_MESSAGE_SIZE,
): boolean {
  return Number.isInteger(length) && length > 0 && length <= maxSize
}

/** Encode a UTF-8 string as a length-prefixed frame (4-byte LE + payload). */
export function encodeLengthPrefixedMessage(
  message: string,
  maxSize = CHROME_NATIVE_MAX_MESSAGE_SIZE,
): Buffer {
  const jsonBytes = Buffer.from(message, 'utf-8')
  if (jsonBytes.length > maxSize) {
    throw new Error(
      `Message exceeds max size (${jsonBytes.length} > ${maxSize})`,
    )
  }
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32LE(jsonBytes.length, 0)
  return Buffer.concat([lengthBuffer, jsonBytes])
}

export type FrameDecodeResult =
  | { ok: true; message: string; remainder: Buffer }
  | { ok: false; reason: 'too_short' | 'invalid_length' | 'incomplete' }

/**
 * Try to read one complete frame from a buffer. Returns remainder for incremental reads.
 */
export function decodeOneLengthPrefixedMessage(
  buffer: Buffer,
  maxSize = CHROME_NATIVE_MAX_MESSAGE_SIZE,
): FrameDecodeResult {
  if (buffer.length < 4) {
    return { ok: false, reason: 'too_short' }
  }

  const length = buffer.readUInt32LE(0)
  if (!isValidFrameLength(length, maxSize)) {
    return { ok: false, reason: 'invalid_length' }
  }

  if (buffer.length < 4 + length) {
    return { ok: false, reason: 'incomplete' }
  }

  const messageBytes = buffer.subarray(4, 4 + length)
  const remainder = buffer.subarray(4 + length)
  return {
    ok: true,
    message: messageBytes.toString('utf-8'),
    remainder,
  }
}

/** Drain all complete frames from a buffer; leaves partial tail in remainder. */
export function decodeAllLengthPrefixedMessages(
  buffer: Buffer,
  maxSize = CHROME_NATIVE_MAX_MESSAGE_SIZE,
): { messages: string[]; remainder: Buffer; invalidLength: boolean } {
  const messages: string[] = []
  let cursor = buffer

  while (cursor.length >= 4) {
    const length = cursor.readUInt32LE(0)
    if (!isValidFrameLength(length, maxSize)) {
      return { messages, remainder: cursor, invalidLength: true }
    }
    if (cursor.length < 4 + length) {
      break
    }
    const decoded = decodeOneLengthPrefixedMessage(cursor, maxSize)
    if (!decoded.ok) {
      break
    }
    messages.push(decoded.message)
    cursor = decoded.remainder
  }

  return { messages, remainder: cursor, invalidLength: false }
}