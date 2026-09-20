import { describe, expect, test } from 'bun:test'
import {
  findContextualWebUrl,
  isPlaceholderWebTarget,
  resolveContextualWebTarget,
} from './contextualReference.js'

const history = [
  {
    message: {
      content: [
        {
          type: 'text',
          text: 'Look up https://github.com/1jehuang/jcode#installation',
        },
      ],
    },
  },
  {
    message: {
      content: [{ type: 'text', text: 'explain jcode for me' }],
    },
  },
]

describe('contextual web references', () => {
  test('matches a named follow-up to its recent URL', () => {
    expect(findContextualWebUrl(history, 'explain jcode for me')).toBe(
      'https://github.com/1jehuang/jcode#installation',
    )
  })

  test('repairs an invented placeholder target', () => {
    expect(
      resolveContextualWebTarget(
        'https://example.com',
        history,
        'explain jcode for me',
      ),
    ).toBe('https://github.com/1jehuang/jcode#installation')
  })

  test('does not rewrite a real explicit target', () => {
    expect(
      resolveContextualWebTarget(
        'https://bun.sh/docs',
        history,
        'read bun docs',
      ),
    ).toBe('https://bun.sh/docs')
    expect(isPlaceholderWebTarget('https://example.com')).toBe(true)
  })
})
