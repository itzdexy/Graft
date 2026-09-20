import { expect, test } from 'bun:test'
import { collectConversationSources } from './conversationSources.js'

const call = (id: string, name: string, input: object = {}) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } })
const result = (id: string, data: object, content = '', is_error = false) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content, is_error }] }, toolUseResult: data })

test('a fetched source supersedes search results, without counting model-invented links', () => {
  expect(collectConversationSources([
    { type: 'assistant', message: { content: [{ type: 'text', text: 'https://invented.example.org' }] } },
    call('s', 'WebSearch'), result('s', { results: [{ content: [{ url: 'https://docs.example.org/api' }] }] }),
    call('f', 'WebFetch'), result('f', { code: 200, url: 'https://docs.example.org/api#section' }),
    call('s2', 'WebSearch'), result('s2', { results: [{ content: [{ url: 'https://docs.example.org/api' }] }] }),
  ])).toEqual([{ url: 'https://docs.example.org/api', kind: 'fetched' }])
})
test('failed tools, redirects, and URLs containing credentials are not fetched sources', () => {
  expect(collectConversationSources([
    call('a', 'WebFetch'), result('a', { code: 200, url: 'https://example.org' }, '', true),
    call('b', 'WebFetch'), result('b', { code: 302, url: 'https://example.org' }),
    call('c', 'WebFetch'), result('c', { code: 200, url: 'https://user:secret@example.org' }),
    call('d', 'GraftWeb', { action: 'read' }), result('d', { output: 'Failed to fetch https://example.org: network unavailable' }),
  ])).toEqual([])
})
test('GraftWeb and rerouted URL reads retain their successful fetched source', () => {
  expect(collectConversationSources([
    call('a', 'GraftWeb', { action: 'read' }), result('a', { output: 'Fetched https://docs.example.org/one (200 OK, 100 bytes):\ntext' }),
    call('b', 'Read', { file_path: 'https://docs.example.org/two' }), result('b', { code: 200, url: 'https://docs.example.org/two' }),
  ])).toHaveLength(2)
})
