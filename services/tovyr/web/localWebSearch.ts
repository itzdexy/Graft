import axios from 'axios'
import { getWebFetchUserAgent } from '../../../utils/http.js'

export type LocalSearchHit = {
  title: string
  url: string
  snippet?: string
}

export type LocalSearchResult = {
  query: string
  hits: LocalSearchHit[]
  durationSeconds: number
  provider: 'duckduckgo' | 'duckduckgo-instant'
}

const SEARCH_TIMEOUT_MS = 20_000
const MAX_HITS = 8

/**
 * Local web search for providers that lack Anthropic server-side web_search
 * (OpenRouter, OpenAI, DeepSeek, FreeModel, custom OpenAI-compat, etc.).
 */
export async function runLocalWebSearch(
  query: string,
  signal?: AbortSignal,
): Promise<LocalSearchResult> {
  const start = performance.now()
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return {
      query: trimmed,
      hits: [],
      durationSeconds: 0,
      provider: 'duckduckgo',
    }
  }

  // Prefer HTML results (richer). Fall back to Instant Answer API.
  try {
    const hits = await searchDuckDuckGoHtml(trimmed, signal)
    if (hits.length > 0) {
      return {
        query: trimmed,
        hits: hits.slice(0, MAX_HITS),
        durationSeconds: (performance.now() - start) / 1000,
        provider: 'duckduckgo',
      }
    }
  } catch {
    // fall through
  }

  const hits = await searchDuckDuckGoInstant(trimmed, signal)
  return {
    query: trimmed,
    hits: hits.slice(0, MAX_HITS),
    durationSeconds: (performance.now() - start) / 1000,
    provider: 'duckduckgo-instant',
  }
}

async function searchDuckDuckGoHtml(
  query: string,
  signal?: AbortSignal,
): Promise<LocalSearchHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const response = await axios.get<string>(url, {
    signal,
    timeout: SEARCH_TIMEOUT_MS,
    responseType: 'text',
    headers: {
      Accept: 'text/html',
      'User-Agent': getWebFetchUserAgent(),
    },
    maxRedirects: 5,
  })

  return parseDuckDuckGoHtml(response.data)
}

/** Parse DuckDuckGo HTML SERP into title/url/snippet triples. */
export function parseDuckDuckGoHtml(html: string): LocalSearchHit[] {
  const hits: LocalSearchHit[] = []
  // Each result block: result__a link + optional result__snippet
  const resultRe =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = resultRe.exec(html)) !== null) {
    const rawHref = match[1] ?? ''
    const title = decodeBasicHtml(stripTags(match[2] ?? '')).trim()
    const url = unwrapDuckDuckGoRedirect(rawHref)
    if (!url || !title || !/^https?:\/\//i.test(url)) continue

    // Snippet: look ahead a bit for result__snippet
    const window = html.slice(match.index, match.index + 1200)
    const snipMatch = window.match(
      /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)/i,
    )
    const snippet = snipMatch
      ? decodeBasicHtml(stripTags(snipMatch[1] ?? '')).trim()
      : undefined

    hits.push({ title, url, snippet: snippet || undefined })
    if (hits.length >= MAX_HITS) break
  }
  return hits
}

function unwrapDuckDuckGoRedirect(href: string): string {
  try {
    // Absolute or relative //duckduckgo.com/l/?uddg=...
    const absolute = href.startsWith('http')
      ? href
      : href.startsWith('//')
        ? `https:${href}`
        : href.startsWith('/')
          ? `https://duckduckgo.com${href}`
          : href
    const parsed = new URL(absolute)
    const uddg = parsed.searchParams.get('uddg')
    if (uddg) return decodeURIComponent(uddg)
    if (parsed.hostname.includes('duckduckgo.com')) {
      const uddg2 = parsed.searchParams.get('uddg')
      if (uddg2) return decodeURIComponent(uddg2)
    }
    return absolute
  } catch {
    return href
  }
}

async function searchDuckDuckGoInstant(
  query: string,
  signal?: AbortSignal,
): Promise<LocalSearchHit[]> {
  const url =
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
    `&format=json&no_html=1&skip_disambig=1`
  const response = await axios.get<{
    AbstractText?: string
    AbstractURL?: string
    Heading?: string
    RelatedTopics?: Array<{
      Text?: string
      FirstURL?: string
      Topics?: Array<{ Text?: string; FirstURL?: string }>
    }>
    Results?: Array<{ Text?: string; FirstURL?: string }>
  }>(url, {
    signal,
    timeout: SEARCH_TIMEOUT_MS,
    headers: { Accept: 'application/json', 'User-Agent': getWebFetchUserAgent() },
  })

  const hits: LocalSearchHit[] = []
  const data = response.data
  if (data.AbstractURL && (data.Heading || data.AbstractText)) {
    hits.push({
      title: data.Heading || data.AbstractURL,
      url: data.AbstractURL,
      snippet: data.AbstractText,
    })
  }
  for (const r of data.Results ?? []) {
    if (r.FirstURL && r.Text) {
      hits.push({ title: r.Text, url: r.FirstURL })
    }
  }
  for (const topic of data.RelatedTopics ?? []) {
    if (topic.FirstURL && topic.Text) {
      hits.push({ title: topic.Text, url: topic.FirstURL })
    }
    for (const nested of topic.Topics ?? []) {
      if (nested.FirstURL && nested.Text) {
        hits.push({ title: nested.Text, url: nested.FirstURL })
      }
    }
  }
  return hits
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

function decodeBasicHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
