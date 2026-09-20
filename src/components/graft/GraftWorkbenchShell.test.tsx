import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { FullscreenLayout } from '../FullscreenLayout.js'
import type { ScrollBoxHandle } from '../../ink/components/ScrollBox.js'
import { renderToText } from '../../test/renderInk.js'
import {
  shouldShowGraftEmptyTranscript,
  GraftWorkbenchShell,
} from './GraftWorkbenchShell.js'

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

const wideFileInput = {
  columns: 140,
  rows: 24,
  requestedFocus: 'file' as const,
  approvalPending: false,
}

describe('GraftWorkbenchShell', () => {
  test('only shows the empty state for a genuinely idle transcript', () => {
    expect(
      shouldShowGraftEmptyTranscript({
        messageCount: 0,
        pendingUserText: '',
        isLoading: false,
        isProcessing: false,
        activeToolCount: 0,
      }),
    ).toBe(true)

    for (const state of [
      { pendingUserText: 'Fix the parser' },
      { isLoading: true },
      { isProcessing: true },
      { activeToolCount: 1 },
      { messageCount: 1 },
    ]) {
      expect(
        shouldShowGraftEmptyTranscript({
          messageCount: 0,
          pendingUserText: '',
          isLoading: false,
          isProcessing: false,
          activeToolCount: 0,
          ...state,
        }),
      ).toBe(false)
    }
  })

  test('REPL mounts the shell only through the Graft runtime branch', () => {
    const repl = readFileSync(new URL('../../screens/REPL.tsx', import.meta.url), 'utf8')

    expect(repl).toContain("import { GraftWorkbenchShell } from '../components/graft/GraftWorkbenchShell.js'")
    expect(repl).toMatch(/isGraftRuntime\(\) \? \(\s*<GraftWorkbenchShell/)
    expect(repl).toContain('overlay={toolPermissionOverlay}')
    expect(repl).not.toContain('focus={toolPermissionOverlay}')
  })

  test('routes the indexed /files command into the live file focus surface', () => {
    const repl = readFileSync(new URL('../../screens/REPL.tsx', import.meta.url), 'utf8')
    const files = readFileSync(new URL('../../commands/files/index.ts', import.meta.url), 'utf8')

    expect(files).toContain("name: 'files'")
    expect(files).toContain('isGraftRuntime()')
    expect(repl).toContain('resolveWorkbenchFocusFromCommand(input, commands, isCommandEnabled)')
    expect(repl).toContain("requestedFocus: viewedAgentTask ? 'agents' : requestedWorkbenchFocus")
  })

  test('renders the actual project map for the routed file focus without a placeholder node', async () => {
    const { output } = await renderToText(
      <GraftWorkbenchShell
        input={wideFileInput}
        transcript={<Text>chat</Text>}
        composer={<Text>prompt</Text>}
        fileRoot={process.cwd()}
      />,
      { columns: 140 },
    )

    expect(output).toContain('Project map')
  })

  test('renders transcript and composer at 50 columns without a side rail', async () => {
    const { output } = await renderToText(
      <GraftWorkbenchShell
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

  test('keeps an empty transcript free of suggestions', async () => {
    const { output } = await renderToText(
      <GraftWorkbenchShell
        input={compactInput}
        transcript={<Text>chat</Text>}
        composer={<Text>prompt</Text>}
        isTranscriptEmpty
      />,
      { columns: 50 },
    )

    expect(output).toContain('chat')
    expect(output).toContain('prompt')
    expect(output).not.toContain('? help')
  })

  test('keeps the normal-width conversation free of shortcut chrome', async () => {
    const { output } = await renderToText(
      <GraftWorkbenchShell
        input={normalInput}
        transcript={<Text>chat</Text>}
        composer={<Text>prompt</Text>}
        isTranscriptEmpty
      />,
      { columns: 80 },
    )

    expect(output).toContain('chat')
    expect(output).toContain('prompt')
    expect(output).not.toContain('Try asking')
    expect(output).not.toContain('? help')
  })

  test('uses an overlay instead of reserving a side rail at 80 columns', async () => {
    const { output } = await renderToText(
      <GraftWorkbenchShell
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
      <GraftWorkbenchShell
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

  test('keeps a wide plan rail inside a 140-column frame with long transcript content', async () => {
    const { lastFrame } = await renderToText(
      <GraftWorkbenchShell
        input={widePlanInput}
        transcript={<Text>{'T'.repeat(320)}</Text>}
        composer={<Text>prompt</Text>}
        focus={<Text>plan steps</Text>}
      />,
      { columns: 140, rows: 8 },
    )
    const focusLine = lastFrame.split('\n').find(line => line.includes('│ plan'))

    expect(focusLine).toBeDefined()
    expect(focusLine!.indexOf('│ plan')).toBeGreaterThan(80)
    expect(focusLine!.indexOf('│ plan')).toBeLessThan(120)
    expect(focusLine!.length).toBeLessThanOrEqual(140)
    expect(lastFrame).toContain('plan steps')
  })

  test('does not cap a long transcript inside a constrained ScrollBox', async () => {
    const scrollRef = React.createRef<ScrollBoxHandle>()
    let scrollHeight = 0
    let viewportHeight = 0
    const transcript = (
      <Box flexDirection="column">
        {Array.from({ length: 40 }, (_, index) => (
          <Text key={index}>{`transcript row ${index}`}</Text>
        ))}
      </Box>
    )

    const result = await renderToText(
      <Box height={5} width={80} flexDirection="column">
        <FullscreenLayout
          scrollRef={scrollRef}
          scrollable={
            <GraftWorkbenchShell
              input={{ ...normalInput, rows: 20, requestedFocus: 'none' }}
              transcript={transcript}
              composer={null}
            />
          }
          bottom={<Text>prompt</Text>}
        />
      </Box>,
      {
        columns: 80,
        rows: 5,
        env: { GRAFT_CODE_NO_FLICKER: '1' },
        interact: async () => {
          const handle = scrollRef.current
          expect(handle).not.toBeNull()
          await new Promise(resolve => setTimeout(resolve, 30))
          scrollHeight = handle!.getFreshScrollHeight()
          viewportHeight = handle!.getViewportHeight()
          handle!.scrollToBottom()
        },
      },
    )

    expect(result.lastFrame).toContain('transcript row 39')
    expect(scrollHeight).toBeGreaterThan(viewportHeight)
  })

  test('keeps wide permission decisions full width instead of a side rail', async () => {
    const { output } = await renderToText(
      <GraftWorkbenchShell
        input={{ ...widePlanInput, approvalPending: true }}
        transcript={<Text>chat</Text>}
        composer={<Text>prompt</Text>}
        focus={
          <Box flexDirection="column">
            <Text>Review command and diff before continuing</Text>
            <Text>Allow once</Text>
            <Text>Deny</Text>
          </Box>
        }
      />,
      { columns: 140 },
    )

    expect(output).toContain('Review command and diff before')
    expect(output).toContain('continuing')
    expect(output).toContain('Allow once')
    expect(output).toContain('Deny')
    expect(output).not.toContain('│ permission')
  })

  test('keeps wide approval controls reachable through the fullscreen overlay', async () => {
    const { lastFrame } = await renderToText(
      <Box height={12} width={140} flexDirection="column">
        <FullscreenLayout
          scrollable={
            <GraftWorkbenchShell
              input={widePlanInput}
              transcript={<Text>chat</Text>}
              composer={null}
            />
          }
          overlay={
            <Box flexDirection="column">
              <Text>Review command and diff before continuing</Text>
              <Text>Allow once</Text>
              <Text>Deny</Text>
            </Box>
          }
          bottom={<Text>prompt</Text>}
        />
      </Box>,
      { columns: 140, rows: 12, env: { GRAFT_CODE_NO_FLICKER: '1' } },
    )

    expect(lastFrame).toContain('Allow once')
    expect(lastFrame).toContain('Deny')
    expect(lastFrame).toContain('prompt')
  })

  test('hides optional context on short terminals while keeping the composer reachable', async () => {
    const { output } = await renderToText(
      <GraftWorkbenchShell
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
