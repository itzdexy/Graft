import * as React from 'react'
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Text } from '../../ink.js'
import { renderToText } from '../../test/renderInk.js'
import { GraftWorkspaceDashboard } from './GraftWorkspaceDashboard.js'
import { GraftWorkbenchShell } from './GraftWorkbenchShell.js'

describe('minimal Graft chat', () => {
  test('shows Buddy, model, date and folder without a welcome dashboard', async () => {
    const { lastFrame } = await renderToText(
      <GraftWorkspaceDashboard
        cwd={join('projects', 'my-app')}
        model="Qwen 2.5 Coder"
        date={new Date(2026, 8, 19)}
      />,
      { columns: 80 },
    )
    expect(lastFrame).toContain('Graft · Qwen 2.5 Coder')
    expect(lastFrame).toContain('Sep 19, 2026')
    expect(lastFrame).toContain('my-app')
    expect(lastFrame).toContain('█')
    for (const clutter of ['Try asking', '/code', '/plan', 'ctrl+p', 'session', 'v1.4.0']) {
      expect(lastFrame).not.toContain(clutter)
    }
  })

  test('long metadata fits a narrow terminal', async () => {
    const { lastFrame } = await renderToText(
      <GraftWorkspaceDashboard cwd="a-very-long-project-folder-name" model="provider/a-very-long-model-identifier" />,
      { columns: 30 },
    )
    for (const line of lastFrame.split('\n')) expect([...line].length).toBeLessThanOrEqual(30)
  })

  test('one identity block leaves chat and the composer visible', async () => {
    const { lastFrame } = await renderToText(
      <GraftWorkbenchShell
        input={{ columns: 80, rows: 24, requestedFocus: 'none', approvalPending: false }}
        context={{ project: 'my-app', model: 'test-model', session: 'session duplicate', connection: 'default' }}
        transcript={<Text>Hello from the chat</Text>}
        composer={<Text>Message Graft…</Text>}
        isTranscriptEmpty
      />,
      { columns: 80 },
    )
    expect(lastFrame.match(/test-model/g)).toHaveLength(1)
    expect(lastFrame).toContain('Hello from the chat')
    expect(lastFrame).toContain('Message Graft…')
    expect(lastFrame).not.toContain('session duplicate')
    expect(lastFrame).not.toContain('Try asking')
  })
})
