import { expect, test } from 'bun:test'
import { WebFetchTool, isRoutinePublicWebRead } from './WebFetchTool.js'
import { WebSearchTool } from '../WebSearchTool/WebSearchTool.js'
import { normalizeToolArguments, normalizeWebToolCall } from '../../services/graft/openaiCompat/toolNormalization.js'

function context(rules: { deny?: string[]; ask?: string[] } = {}) {
  return { getAppState: () => ({ toolPermissionContext: {
    mode: 'default', alwaysAllowRules: {},
    alwaysDenyRules: { localSettings: rules.deny ?? [] },
    alwaysAskRules: { localSettings: rules.ask ?? [] },
  } }) } as never
}
test('public research fetches are allowed without a permission prompt', async () => {
  const result = await WebFetchTool.checkPermissions({ url: 'https://en.wikipedia.org/wiki/History_of_mathematics', prompt: 'Read' }, context())
  expect(result.behavior).toBe('allow')
})
test('explicit web ask and deny rules still win', async () => {
  const input = { url: 'https://en.wikipedia.org/wiki/History_of_mathematics', prompt: 'Read' }
  expect((await WebFetchTool.checkPermissions(input, context({ deny: ['WebFetch(domain:en.wikipedia.org)'] }))).behavior).toBe('deny')
  expect((await WebFetchTool.checkPermissions(input, context({ ask: ['WebFetch(domain:en.wikipedia.org)'] }))).behavior).toBe('ask')
})
test('private and credential-bearing URLs do not get routine public approval', async () => {
  for (const url of ['http://localhost/', 'http://127.0.0.1/', 'http://10.0.0.1/', 'https://user:pass@example.org/', 'file:///tmp/a', 'http://service.internal/']) {
    expect(isRoutinePublicWebRead(url)).toBe(false)
    expect((await WebFetchTool.checkPermissions({ url, prompt: 'Read' }, context())).behavior).toBe('ask')
  }
})
test('model URL reads route to WebFetch with valid input; local paths stay Read', () => {
  const routed = normalizeWebToolCall('Read', { file_path: 'https://en.wikipedia.org/wiki/History_of_mathematics' })
  expect(routed.name).toBe('WebFetch')
  expect(WebFetchTool.inputSchema.safeParse(routed.input).success).toBe(true)
  for (const file_path of ['README.md', 'C:\\project\\readme.md', '/tmp/readme.md']) expect(normalizeWebToolCall('Read', { file_path }).name).toBe('Read')
})
test('missing fetch prompt, bare hostname, and search aliases normalize to valid schemas', () => {
  const fetch = normalizeToolArguments('WebFetch', { url: 'en.wikipedia.org/wiki/History_of_mathematics' })
  expect(fetch.url).toBe('https://en.wikipedia.org/wiki/History_of_mathematics')
  expect(WebFetchTool.inputSchema.safeParse(fetch).success).toBe(true)
  expect(WebSearchTool.inputSchema.safeParse(normalizeToolArguments('WebSearch', { search_query: 'history of mathematics', action: 'search' })).success).toBe(true)
  expect(normalizeToolArguments('WebFetch', { url: 'file:///private' }).url).toBe('file:///private')
})
