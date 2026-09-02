import { describe, expect, test } from 'bun:test'
import * as React from 'react'
import { renderToText } from '../../test/renderInk.js'
import { TovyrCompactToolRow } from './TovyrCompactToolRow.js'

/**
 * A failed tool used to render as a bare red `✗ Glob "*"` — the status said
 * something broke and nothing said what, because the row was never handed the
 * tool result. That made every tool failure undiagnosable from the transcript.
 */
describe('TovyrCompactToolRow explains failures', () => {
  test('shows the error text when a tool fails', async () => {
    const { output } = await renderToText(
      React.createElement(TovyrCompactToolRow, {
        toolName: 'Glob',
        input: { pattern: '*' },
        status: 'failed',
        resultPreview: 'EPERM: operation not permitted, scandir E:\Medal',
      }),
    )
    expect(output).toContain('Glob')
    expect(output).toContain('EPERM')
  })

  test('a failure with no output still says so', async () => {
    const { output } = await renderToText(
      React.createElement(TovyrCompactToolRow, {
        toolName: 'Glob',
        input: { pattern: '*' },
        status: 'failed',
      }),
    )
    // The regression: an empty resultSummary rendered an empty row.
    expect(output).toContain('failed with no output')
  })

  test('a succeeded row stays compact', async () => {
    const { output } = await renderToText(
      React.createElement(TovyrCompactToolRow, {
        toolName: 'Read',
        input: { file_path: 'src/index.ts' },
        status: 'succeeded',
        resultPreview: 'a hundred lines of file content',
      }),
    )
    expect(output).toContain('Read')
    // Success detail stays folded away; only failures auto-expand.
    expect(output).not.toContain('a hundred lines of file content')
  })
})
