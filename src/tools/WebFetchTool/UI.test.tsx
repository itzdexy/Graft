import { describe, expect, test } from 'bun:test'
import React from 'react'
import { Link } from '../../ink.js'
import { renderToolUseMessage } from './UI.js'

describe('WebFetch tool links', () => {
  test('renders HTTP URLs as terminal hyperlinks', () => {
    const url = 'https://example.com/watch?v=123'
    const rendered = renderToolUseMessage(
      { url },
      { verbose: false },
    )

    expect(React.isValidElement(rendered)).toBe(true)
    expect((rendered as React.ReactElement).type).toBe(Link)
    expect((rendered as React.ReactElement<{ url: string }>).props.url).toBe(url)
  })

  test('does not hyperlink unsupported URL protocols', () => {
    expect(
      renderToolUseMessage(
        { url: 'javascript:alert(1)' },
        { verbose: false },
      ),
    ).toBe('javascript:alert(1)')
  })
})
