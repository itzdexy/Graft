import { describe, expect, test } from 'bun:test'
import {
  INITIAL_STATE,
  parseMultipleKeypresses,
} from '../parse-keypress.js'
import { InputEvent } from './input-event.js'

function enterEvent(char: '\n' | '\r'): InputEvent {
  const [keys] = parseMultipleKeypresses(INITIAL_STATE, char)
  const key = keys[0]
  if (!key || !('name' in key)) {
    throw new Error(`expected keypress for ${JSON.stringify(char)}`)
  }
  return new InputEvent(key)
}

describe('InputEvent Enter key', () => {
  test('LF (\\n) from Windows consoles sets key.return', () => {
    const event = enterEvent('\n')
    expect(event.key.return).toBe(true)
    expect(event.input).toBe('')
  })

  test('CR (\\r) sets key.return', () => {
    const event = enterEvent('\r')
    expect(event.key.return).toBe(true)
    expect(event.input).toBe('')
  })
})
