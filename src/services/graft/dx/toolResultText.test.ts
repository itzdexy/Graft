import { describe, expect, test } from 'bun:test'
import {
  extractToolResultPreview,
  flattenToolResultContent,
} from './toolResultText.js'

const userMessage = (content: unknown) => ({
  type: 'user',
  message: { role: 'user', content },
})

describe('flattenToolResultContent', () => {
  test('passes a plain string through', () => {
    expect(flattenToolResultContent('boom')).toBe('boom')
  })

  test('joins text blocks', () => {
    expect(
      flattenToolResultContent([
        { type: 'text', text: 'line one' },
        { type: 'text', text: 'line two' },
      ]),
    ).toBe('line one\nline two')
  })

  test('skips non-text blocks', () => {
    expect(
      flattenToolResultContent([
        { type: 'image', source: {} },
        { type: 'text', text: 'kept' },
      ]),
    ).toBe('kept')
  })

  test('returns empty for unusable shapes', () => {
    expect(flattenToolResultContent(undefined)).toBe('')
    expect(flattenToolResultContent(42)).toBe('')
  })
})

describe('extractToolResultPreview', () => {
  test('finds the matching tool_result and condenses it', () => {
    const message = userMessage([
      {
        type: 'tool_result',
        tool_use_id: 't1',
        is_error: true,
        content: 'EPERM: operation not permitted,\n   scandir E:\\Medal',
      },
    ])
    expect(extractToolResultPreview(message, 't1')).toBe(
      'EPERM: operation not permitted, scandir E:\\Medal',
    )
  })

  test('matches only the requested tool_use_id', () => {
    const message = userMessage([
      { type: 'tool_result', tool_use_id: 'other', content: 'not mine' },
      { type: 'tool_result', tool_use_id: 't1', content: 'mine' },
    ])
    expect(extractToolResultPreview(message, 't1')).toBe('mine')
  })

  test('returns undefined when the id is absent', () => {
    const message = userMessage([
      { type: 'tool_result', tool_use_id: 'other', content: 'x' },
    ])
    expect(extractToolResultPreview(message, 't1')).toBeUndefined()
  })

  test('returns undefined for an empty result rather than a blank row', () => {
    const message = userMessage([
      { type: 'tool_result', tool_use_id: 't1', content: '   \n  ' },
    ])
    expect(extractToolResultPreview(message, 't1')).toBeUndefined()
  })

  test('truncates a very long result', () => {
    const message = userMessage([
      { type: 'tool_result', tool_use_id: 't1', content: 'x'.repeat(900) },
    ])
    const preview = extractToolResultPreview(message, 't1')!
    expect(preview.length).toBe(400)
    expect(preview.endsWith('…')).toBe(true)
  })

  test('ignores non-user messages and missing input', () => {
    expect(extractToolResultPreview(undefined, 't1')).toBeUndefined()
    expect(
      extractToolResultPreview({ type: 'assistant', message: {} }, 't1'),
    ).toBeUndefined()
  })
})
