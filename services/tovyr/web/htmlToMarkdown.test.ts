import { describe, expect, test } from 'bun:test'
import { stripHtmlToMarkdown } from './htmlToMarkdown.js'
import { parseDuckDuckGoHtml } from './localWebSearch.js'

describe('stripHtmlToMarkdown', () => {
  test('extracts headings and links', () => {
    const md = stripHtmlToMarkdown(
      '<html><body><h1>Hello</h1><p>See <a href="https://example.com">ex</a></p></body></html>',
    )
    expect(md).toContain('# Hello')
    expect(md).toContain('[ex](https://example.com)')
  })
})

describe('parseDuckDuckGoHtml', () => {
  test('parses result__a links and unwraps uddg', () => {
    const html = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent('https://openai.com/index/gpt-5')}">GPT-5</a>
      <a class="result__snippet">Announcement</a>
    `
    const hits = parseDuckDuckGoHtml(html)
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits[0]!.title).toBe('GPT-5')
    expect(hits[0]!.url).toBe('https://openai.com/index/gpt-5')
  })
})
