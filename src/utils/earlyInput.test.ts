import { describe, expect, test } from 'bun:test'
import {
  consumeEarlyInput,
  seedEarlyInput,
  stopCapturingEarlyInput,
} from './earlyInput.js'

describe('earlyInput', () => {
  test('consumeEarlyInput returns text without submit when no newline', () => {
    stopCapturingEarlyInput()
    seedEarlyInput('hi')
    expect(consumeEarlyInput()).toEqual({ text: 'hi', shouldSubmit: false })
  })

  test('consumeEarlyInput shouldSubmit when Enter was pressed during capture', () => {
    stopCapturingEarlyInput()
    seedEarlyInput('hi\n')
    expect(consumeEarlyInput()).toEqual({ text: 'hi', shouldSubmit: true })
  })

  test('consumeEarlyInput handles Windows CRLF submit', () => {
    stopCapturingEarlyInput()
    seedEarlyInput('hello\r\n')
    expect(consumeEarlyInput()).toEqual({ text: 'hello', shouldSubmit: true })
  })
})
