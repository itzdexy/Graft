import { expect, test } from 'bun:test'
import { parseDuckDuckGoHtml, runLocalWebSearch } from './localWebSearch.js'

test('snippets cannot leak from the next result and attribute order is flexible', () => {
  const hits = parseDuckDuckGoHtml(`<a href='https://example.org/one' class='result__a'>One</a>
    <a class="result__a" href="https://example.org/two">Two</a>
    <div class='result__snippet'>Only about two</div>`)
  expect(hits).toEqual([
    { title: 'One', url: 'https://example.org/one', snippet: undefined },
    { title: 'Two', url: 'https://example.org/two', snippet: 'Only about two' },
  ])
})
test('redirect decoding preserves encoded path characters and removes duplicate or unsafe sources', () => {
  const url = 'https://example.org/a%2Fb?x=1&y=2'
  const html = [
    `https://duckduckgo.com/l/?uddg=${encodeURIComponent(url)}`,
    url.replace('&', '&amp;'), 'javascript:alert(1)', 'https://user:password@example.org/',
  ].map(href => `<a class="result__a" href="${href}">Source</a>`).join('')
  expect(parseDuckDuckGoHtml(html).map(h => h.url)).toEqual([url])
})
test('cancellation propagates without starting a fallback request', async () => {
  const controller = new AbortController()
  let requests = 0
  const result = runLocalWebSearch('query', controller.signal, async () => {
    requests++
    controller.abort(new Error('cancelled by test'))
    throw controller.signal.reason
  })
  await expect(result).rejects.toThrow('cancelled by test')
  expect(requests).toBe(1)
})
test('network failures are distinct from a valid empty search', async () => {
  const failed = await runLocalWebSearch('query', undefined, async () => { throw new Error('offline') })
  expect(failed.status).toBe('unavailable')
  const empty = await runLocalWebSearch('query', undefined, async url => url.includes('html.') ? '<html></html>' : {})
  expect(empty.status).toBe('empty')
})
test('instant fallback returns usable deduplicated sources', async () => {
  const result = await runLocalWebSearch('query', undefined, async url => url.includes('html.') ? '' : {
    Results: [{ Text: 'Docs', FirstURL: 'https://example.org/docs' }, { Text: 'Duplicate', FirstURL: 'https://example.org/docs' }, { Text: 'Unsafe', FirstURL: 'file:///private' }],
  })
  expect(result.status).toBe('ok')
  expect(result.provider).toBe('duckduckgo-instant')
  expect(result.hits).toHaveLength(1)
})
