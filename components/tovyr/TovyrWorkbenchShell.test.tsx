import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as React from 'react'
import { Text } from '../../ink.js'
import { renderToText } from '../../test-support/renderInk.js'
import { TovyrWorkbenchShell } from './TovyrWorkbenchShell.js'

const compactInput = {
  columns: 50,
  rows: 24,
  requestedFocus: 'plan' as const,
  approvalPending: false,
}

const normalInput = {
  columns: 80,
  rows: 24,
  requestedFocus: 'plan' as const,
  approvalPending: false,
}

const widePlanInput = {
  columns: 140,
  rows: 24,
  requestedFocus: 'plan' as const,
  approvalPending: false,
}

describe('TovyrWorkbenchShell', () => {
  test('REPL mounts the shell only through the Tovyr runtime branch', () => {
    const repl = readFileSync(new URL('../../screens/REPL.tsx', import.meta.url), 'utf8')

    expect(repl).toContain("import { TovyrWorkbenchShell } from '../components/tovyr/TovyrWorkbenchShell.js'")
    expect(repl).toMatch(/isTovyrRuntime\(\) \? \(\s*<TovyrWorkbenchShell/)
  })

  test('renders transcript and composer at 50 columns without a side rail', async () => {
    const { output } = await renderToText(
      <TovyrWorkbenchShell
        input={compactInput}
        transcript={<Text>chat</Text>}
        composer={<Text>prompt</Text>}
        focus={<Text>plan steps</Text>}
      />,
      { columns: 50 },
    )

    expect(output).toContain('chat')
    expect(output).toContain('prompt')
    expect(output).toContain('plan steps')
    expect(output).not.toContain('│ plan')
  })

  test('uses an overlay instead of reserving a side rail at 80 columns', async () => {
    const { output } = await renderToText(
      <TovyrWorkbenchShell
        input={normalInput}
        transcript={<Text>chat</Text>}
        composer={<Text>prompt</Text>}
        focus={<Text>plan steps</Text>}
      />,
      { columns: 80 },
    )

    expect(output).toContain('chat')
    expect(output).toContain('plan steps')
    expect(output).toContain('prompt')
    expect(output).not.toContain('│ plan')
  })

  test('renders requested focus beside transcript when wide', async () => {
    const { output } = await renderToText(
      <TovyrWorkbenchShell
        input={widePlanInput}
        transcript={<Text>chat</Text>}
        composer={<Text>prompt</Text>}
        focus={<Text>plan steps</Text>}
      />,
      { columns: 140 },
    )

    expect(output).toContain('chat')
    expect(output).toContain('plan steps')
    expect(output).toContain('prompt')
    expect(output).toContain('│ plan')
  })

  test('hides optional context on short terminals while keeping the composer reachable', async () => {
    const { output } = await renderToText(
      <TovyrWorkbenchShell
        input={{ ...widePlanInput, rows: 15 }}
        context={{ project: 'src', provider: 'FreeModel', model: 'fast' }}
        transcript={<Text>chat</Text>}
        composer={<Text>prompt</Text>}
        focus={<Text>plan steps</Text>}
      />,
      { columns: 140, rows: 15 },
    )

    expect(output).not.toContain('FreeModel')
    expect(output).toContain('prompt')
  })
})
