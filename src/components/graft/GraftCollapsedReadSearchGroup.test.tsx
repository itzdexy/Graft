import { expect, test } from 'bun:test'
import * as React from 'react'
import { Box, useInput } from '../../ink.js'
import { useMessageActions } from '../messageActions.js'
import { renderToText } from '../../test/renderInk.js'
import { GraftCollapsedReadSearchGroup } from './GraftCollapsedReadSearchGroup.js'

const message = {
  type: 'collapsed_read_search',
  messages: [
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'one', name: 'Read', input: { file_path: 'one.ts' } },
          { type: 'tool_use', id: 'two', name: 'Read', input: { file_path: 'two.ts' } },
          { type: 'tool_use', id: 'three', name: 'Read', input: { file_path: 'three.ts' } },
        ],
      },
    },
  ],
} as never

const lookups = {
  erroredToolUseIDs: new Set(),
  resolvedToolUseIDs: new Set(['one', 'two', 'three']),
} as never

test('expanded collapsed group reveals the third detail selected by Enter', async () => {
  const collapsed = await renderToText(
    <GraftCollapsedReadSearchGroup message={message} lookups={lookups} inProgressToolUseIDs={new Set()} />,
  )
  const expanded = await renderToText(
    <GraftCollapsedReadSearchGroup message={message} lookups={lookups} inProgressToolUseIDs={new Set()} expanded />,
  )

  expect(collapsed.lastFrame).not.toContain('three.ts')
  expect(collapsed.lastFrame).toContain('Enter details')
  expect(expanded.lastFrame).toContain('three.ts')
  expect(expanded.lastFrame).toContain('all details')
})

function EnterExpansionHarness() {
  const [cursor, setCursor] = React.useState({
    uuid: 'group',
    msgType: 'collapsed_read_search' as const,
    expanded: false,
  })
  const navRef = React.useRef(null)
  const actions = useMessageActions(cursor, setCursor, navRef, {
    copy: () => {},
    edit: async () => {},
  })
  useInput((_input, key) => {
    if (key.return) actions.handlers['messageActions:enter']?.()
  })

  return (
    <Box>
      <GraftCollapsedReadSearchGroup
        message={message}
        lookups={lookups}
        inProgressToolUseIDs={new Set()}
        expanded={cursor.expanded}
      />
    </Box>
  )
}

test('Enter uses the selected collapsed-group action to reveal details', async () => {
  const result = await renderToText(<EnterExpansionHarness />, {
    settleMs: 120,
    interact: stdin => stdin.write('\r'),
  })

  expect(result.lastFrame).toContain('three.ts')
  expect(result.lastFrame).toContain('all details')
})
