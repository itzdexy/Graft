import { describe, expect, test } from 'bun:test'
import * as React from 'react'
import { renderToText } from '../../test/renderInk.js'
import { AssistantThinkingMessage } from './AssistantThinkingMessage.js'
import { recordThinkingDuration } from '../../services/tovyr/dx/thinkingDurations.js'

const THINKING =
  'The user just said hi, a simple greeting.\nThere is no task to perform here.'

/**
 * Regression cover for the reasoning row. Each of these failed silently before
 * 2026-08-24: the duration was never threaded from the stream, the row showed
 * a bare label with none of the reasoning, and the streaming marker was a
 * glyph that read as an inverted cross.
 */
describe('AssistantThinkingMessage renders something a reader can use', () => {
  test('collapsed row shows a gist, not just a label', async () => {
    const { output } = await renderToText(
      React.createElement(AssistantThinkingMessage, {
        param: { type: 'thinking', thinking: THINKING },
        isTranscriptMode: false,
        verbose: false,
      }),
    )
    expect(output).toContain('Thought')
    // The bug: the row announced reasoning happened and withheld all of it.
    expect(output).toContain('The user just said hi')
  })

  test('collapsed row shows a recorded duration', async () => {
    const text = `${THINKING} unique-for-duration-test`
    recordThinkingDuration(text, 16_300)
    const { output } = await renderToText(
      React.createElement(AssistantThinkingMessage, {
        param: { type: 'thinking', thinking: text },
        isTranscriptMode: false,
        verbose: false,
      }),
    )
    // The bug: every past turn rendered "+ Thought" with no time at all.
    expect(output).toContain('16.3s')
  })

  test('expanded mode shows the full reasoning', async () => {
    const { output } = await renderToText(
      React.createElement(AssistantThinkingMessage, {
        param: { type: 'thinking', thinking: THINKING },
        isTranscriptMode: true,
        verbose: false,
      }),
      { withAppState: true },
    )
    expect(output).toContain('no task to perform')
  })

  test('empty reasoning renders nothing at all', async () => {
    const { output } = await renderToText(
      React.createElement(AssistantThinkingMessage, {
        param: { type: 'thinking', thinking: '   \n  ' },
        isTranscriptMode: false,
        verbose: false,
      }),
    )
    expect(output).not.toContain('Thought')
  })

  test('does not use the inverted-cross glyph', async () => {
    const { output } = await renderToText(
      React.createElement(AssistantThinkingMessage, {
        param: { type: 'thinking', thinking: THINKING },
        isTranscriptMode: false,
        verbose: false,
        isStreaming: true,
      }),
    )
    expect(output).not.toContain('\u2234')
  })
})
