import { expect, test } from 'bun:test'
import { browserSourceHosts, sourceBadge } from './browserSources.js'
import type { Message } from '../../../types/message.js'

test('site badges distinguish known sources and provide a stable fallback', () => {
  expect(sourceBadge('github.com').glyph).toBe('G')
  expect(sourceBadge('en.wikipedia.org').glyph).toBe('W')
  expect(sourceBadge('docs.example.com')).toEqual(sourceBadge('docs.example.com'))
})

test('source counts come only from browser results in the current turn', () => {
  const messages = [
    { type: 'user', message: { content: 'Research https://private.example' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'search', name: 'WebSearch', input: {} }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'search', content: 'https://github.com/a https://github.com/b https://en.wikipedia.org/wiki/Test' }] } },
  ] as unknown as Message[]
  expect(browserSourceHosts(messages)).toEqual(['github.com', 'en.wikipedia.org'])
  expect(browserSourceHosts([...messages, { type: 'user', message: { content: 'New question' } } as Message])).toEqual([])
})
