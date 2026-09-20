import { flattenToolResultContent } from '../dx/toolResultText.js'

export type ConversationSource = { url: string; kind: 'fetched' | 'search' }
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

/** Sources must come from completed web tools, never the model's prose. */
export function collectConversationSources(messages: readonly unknown[]): ConversationSource[] {
  const calls = new Map<string, { name: string; input: Record<string, unknown> }>()
  const sources = new Map<string, ConversationSource>()
  const add = (raw: unknown, kind: ConversationSource['kind']) => {
    if (typeof raw !== 'string' || raw.length > 2048) return
    try {
      const url = new URL(raw)
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) return
      url.hash = ''
      const existing = sources.get(url.href)
      sources.delete(url.href)
      sources.set(url.href, { url: url.href, kind: existing?.kind === 'fetched' ? 'fetched' : kind })
    } catch { /* Invalid links are not sources. */ }
  }
  for (const message of messages.slice(-200)) {
    const root = object(message)
    const content = object(root.message).content
    if (!Array.isArray(content)) continue
    for (const value of content) {
      const block = object(value)
      if (root.type === 'assistant' && block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
        calls.set(block.id, { name: block.name, input: object(block.input) })
      }
      if (root.type !== 'user' || block.type !== 'tool_result' || block.is_error || typeof block.tool_use_id !== 'string') continue
      const call = calls.get(block.tool_use_id)
      if (!call) continue
      const data = object(root.toolUseResult)
      const text = flattenToolResultContent(block.content)
      if (call.name === 'WebSearch' || (call.name === 'GraftWeb' && call.input.action === 'search')) {
        if (typeof data.output === 'string' && /^(?:No results|Failed|Web search is unavailable)/i.test(data.output)) continue
        if (Array.isArray(data.results)) {
          for (const result of data.results) {
            const hits = object(result).content
            if (Array.isArray(hits)) for (const hit of hits) add(object(hit).url, 'search')
          }
        } else {
          for (const match of text.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) add(match[0].replace(/[.,;]+$/, ''), 'search')
        }
      }
      if (call.name === 'WebFetch' || (call.name === 'Read' && typeof call.input.file_path === 'string' && /^https?:\/\//i.test(call.input.file_path))) {
        if (typeof data.code === 'number' && data.code >= 200 && data.code < 300) add(data.url, 'fetched')
      }
      if (call.name === 'GraftWeb' && call.input.action === 'read') {
        const output = typeof data.output === 'string' ? data.output : text.replace(/^\[GraftWeb read\]\s*/, '')
        const fetched = output.match(/^Fetched (https?:\/\/\S+) \(2\d\d\b/)
        if (fetched) add(fetched[1], 'fetched')
      }
    }
  }
  return [...sources.values()].reverse().slice(0, 40)
}

export function formatConversationSources(sources: ConversationSource[]): string {
  if (!sources.length) return 'No completed web sources in the recent conversation. Use /research <question> to start.'
  return ['Sources · recent conversation', ...sources.map((source, i) => `${i + 1}. ${source.kind === 'fetched' ? 'Fetched page' : 'Search result'} · ${source.url}`), '', 'Fetched means retrieved successfully, not independently verified. Search results still need to be opened.'].join('\n')
}
