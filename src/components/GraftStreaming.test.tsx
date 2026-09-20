import React, { useState } from 'react'
import { expect, test } from 'bun:test'
import { StreamingMarkdown } from './Markdown.js'
import { AssistantThinkingMessage } from './messages/AssistantThinkingMessage.js'
import { renderToText } from '../test/renderInk.js'

test('incremental markdown retains every block and closes a split code fence', async () => {
  let update: (value: string) => void = () => {}
  function Stream() {
    const [text, setText] = useState('First paragraph.\n\n```js\nconst')
    update = setText
    return <StreamingMarkdown>{text}</StreamingMarkdown>
  }
  const { lastFrame } = await renderToText(<Stream />, {
    withAppState: true,
    interact: async () => {
      update('First paragraph.\n\n```js\nconst answer = 42;\n```\n\nLast paragraph.')
    },
  })
  expect(lastFrame).toContain('First paragraph.')
  expect(lastFrame).toContain('answer = 42')
  expect(lastFrame).toContain('Last paragraph.')
  expect(lastFrame.match(/First paragraph/g)?.length).toBe(1)
})

test('live thinking follows the latest line without expanding the transcript', async () => {
  let update: (value: string) => void = () => {}
  function Thinking() {
    const [text, setText] = useState('Checking the first idea')
    update = setText
    return <AssistantThinkingMessage param={{ type: 'thinking', thinking: text }} isStreaming isTranscriptMode={false} verbose={false} />
  }
  const { lastFrame } = await renderToText(<Thinking />, {
    withAppState: true,
    interact: () => update('Checking the first idea\nFound the command loader failure'),
  })
  expect(lastFrame).toContain('Thinking')
  expect(lastFrame).toContain('Found the command loader failure')
  expect(lastFrame).not.toContain('Checking the first idea')
})
