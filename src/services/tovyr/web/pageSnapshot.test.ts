import { describe, expect, test } from 'bun:test'
import {
  buildPageSnapshot,
  extractInlineStyles,
  extractStylesheetLinks,
  extractTitle,
  MAX_HTML_CHARS,
  MAX_CSS_TOTAL_CHARS,
  MAX_STYLESHEETS,
} from './pageSnapshot.js'

const BASE = 'https://aside.com/'

describe('extractStylesheetLinks', () => {
  test('resolves relative hrefs against the page url', () => {
    const refs = extractStylesheetLinks(
      '<link rel="stylesheet" href="/assets/app.css">',
      BASE,
    )
    expect(refs).toEqual([
      { url: 'https://aside.com/assets/app.css', href: '/assets/app.css' },
    ])
  })

  test('matches regardless of attribute order', () => {
    const refs = extractStylesheetLinks(
      '<link href="a.css" rel="stylesheet">',
      BASE,
    )
    expect(refs[0]?.url).toBe('https://aside.com/a.css')
  })

  test('accepts unquoted and single-quoted hrefs', () => {
    expect(
      extractStylesheetLinks("<link rel=stylesheet href='b.css'>", BASE)[0]?.url,
    ).toBe('https://aside.com/b.css')
    expect(
      extractStylesheetLinks('<link rel=stylesheet href=c.css>', BASE)[0]?.url,
    ).toBe('https://aside.com/c.css')
  })

  test('handles rel with extra tokens like "preload stylesheet"', () => {
    const refs = extractStylesheetLinks(
      '<link rel="preload stylesheet" href="d.css">',
      BASE,
    )
    expect(refs).toHaveLength(1)
  })

  test('ignores non-stylesheet links', () => {
    const refs = extractStylesheetLinks(
      '<link rel="icon" href="/favicon.ico"><link rel="preconnect" href="https://x.test">',
      BASE,
    )
    expect(refs).toEqual([])
  })

  test('keeps absolute cross-origin stylesheets', () => {
    const refs = extractStylesheetLinks(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">',
      BASE,
    )
    expect(refs[0]?.url).toBe('https://fonts.googleapis.com/css2?family=Inter')
  })

  test('skips non-http schemes', () => {
    const refs = extractStylesheetLinks(
      '<link rel="stylesheet" href="data:text/css,body{}">',
      BASE,
    )
    expect(refs).toEqual([])
  })

  test('deduplicates repeated hrefs', () => {
    const refs = extractStylesheetLinks(
      '<link rel="stylesheet" href="a.css"><link rel="stylesheet" href="a.css">',
      BASE,
    )
    expect(refs).toHaveLength(1)
  })

  test('caps the number of stylesheets', () => {
    const html = Array.from(
      { length: MAX_STYLESHEETS + 5 },
      (_unused, i) => `<link rel="stylesheet" href="s${i}.css">`,
    ).join('')
    expect(extractStylesheetLinks(html, BASE)).toHaveLength(MAX_STYLESHEETS)
  })

  test('survives a malformed href without throwing', () => {
    expect(() =>
      extractStylesheetLinks('<link rel="stylesheet" href="ht tp://%%">', BASE),
    ).not.toThrow()
  })
})

describe('extractInlineStyles', () => {
  test('collects style blocks in order', () => {
    expect(
      extractInlineStyles('<style>a{}</style><style>b{}</style>'),
    ).toEqual(['a{}', 'b{}'])
  })

  test('handles attributes on the style tag', () => {
    expect(extractInlineStyles('<style type="text/css">x{}</style>')).toEqual([
      'x{}',
    ])
  })

  test('skips empty blocks', () => {
    expect(extractInlineStyles('<style>   </style>')).toEqual([])
  })
})

describe('extractTitle', () => {
  test('reads and collapses the title', () => {
    expect(extractTitle('<title>  Aside —\n  Browser </title>')).toBe(
      'Aside — Browser',
    )
  })

  test('returns empty when absent', () => {
    expect(extractTitle('<html></html>')).toBe('')
  })
})

describe('buildPageSnapshot', () => {
  const base = {
    url: BASE,
    html: '<html><title>Aside</title><body>hi</body></html>',
    inlineStyles: [],
    stylesheets: [],
  }

  test('includes the real markup, not a summary', () => {
    const out = buildPageSnapshot(base)
    expect(out).toContain('<body>hi</body>')
    expect(out).toContain('## HTML')
    expect(out).toContain('Aside')
  })

  test('labels each stylesheet with its source url', () => {
    const out = buildPageSnapshot({
      ...base,
      stylesheets: [{ url: 'https://aside.com/app.css', css: 'body{color:red}' }],
    })
    expect(out).toContain('## Stylesheet: https://aside.com/app.css')
    expect(out).toContain('body{color:red}')
  })

  test('includes inline style blocks', () => {
    const out = buildPageSnapshot({ ...base, inlineStyles: ['h1{margin:0}'] })
    expect(out).toContain('Inline <style>')
    expect(out).toContain('h1{margin:0}')
  })

  test('says so when no CSS was found, rather than implying there is none', () => {
    const out = buildPageSnapshot(base)
    expect(out).toContain('No stylesheets were found')
  })

  test('shares one CSS budget across all stylesheets', () => {
    const big = `.a{}`.repeat(30_000)
    const out = buildPageSnapshot({
      ...base,
      stylesheets: [
        { url: 'https://a.test/1.css', css: big },
        { url: 'https://a.test/2.css', css: big },
        { url: 'https://a.test/3.css', css: big },
      ],
    })
    // Every sheet is still listed, so the model knows what exists...
    expect(out).toContain('https://a.test/3.css')
    // ...but the combined CSS cannot exceed the shared budget.
    const cssChars = (out.match(/```css[\s\S]*?```/g) ?? []).join('').length
    expect(cssChars).toBeGreaterThan(1_000)
    expect(cssChars).toBeLessThan(MAX_CSS_TOTAL_CHARS + 5_000)
  })

  test('truncates oversized HTML and marks the cut', () => {
    const out = buildPageSnapshot({ ...base, html: 'x'.repeat(MAX_HTML_CHARS + 500) })
    expect(out).toContain('HTML truncated at')
    expect(out.length).toBeLessThan(MAX_HTML_CHARS + 2_000)
  })
})
