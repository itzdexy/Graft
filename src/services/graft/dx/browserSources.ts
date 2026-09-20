import type { Message } from '../../../types/message.js'

export function sourceBadge(host: string): { glyph: string; color: `#${string}` } {
  const name = host.replace(/^www\./, '').toLowerCase()
  const known: Record<string, { glyph: string; color: `#${string}` }> = {
    'github.com': { glyph: 'G', color: '#b7a8ff' },
    'wikipedia.org': { glyph: 'W', color: '#d5d5d5' },
    'reddit.com': { glyph: 'R', color: '#ff875f' },
    'youtube.com': { glyph: '▶', color: '#ff6565' },
    'stackoverflow.com': { glyph: 'S', color: '#ffb366' },
  }
  for (const [domain, badge] of Object.entries(known)) {
    if (name === domain || name.endsWith(`.${domain}`)) return badge
  }
  const palette = ['#82b8ff', '#99d6ac', '#dfb0ef', '#e5c28b'] as const
  const hash = [...name].reduce((n, char) => n + char.charCodeAt(0), 0)
  return { glyph: name[0]?.toUpperCase() || '↗', color: palette[hash % palette.length]! }
}

/** Read URLs only from browser tool results in the current turn, never user text. */
export function browserSourceHosts(messages: Message[]): string[] {
  const tools = new Set<string>()
  const hosts = new Set<string>()
  const recent: Message[] = []
  for (let i = messages.length - 1; i >= 0 && recent.length < 40; i--) {
    const message = messages[i]!
    if (message.type === 'user' && (typeof message.message.content === 'string' || message.message.content.some(b => b.type === 'text'))) break
    recent.unshift(message)
  }
  for (const message of recent) {
    if (message.type !== 'assistant' && message.type !== 'user') continue
    const blocks = message.message.content
    if (!Array.isArray(blocks)) continue
    for (const block of blocks) {
      if (block.type === 'tool_use' && /^(WebSearch|WebFetch|GraftWeb|WebsiteTest)$|^mcp__playwright__browser_/.test(block.name)) tools.add(block.id)
      if (block.type !== 'tool_result' || !tools.has(block.tool_use_id)) continue
      const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
      for (const match of text.slice(0, 40000).matchAll(/https?:\/\/[^\s<>"\\)\]]+/g)) {
        try { hosts.add(new URL(match[0]).hostname.replace(/^www\./, '')) } catch {}
        if (hosts.size >= 12) return [...hosts]
      }
    }
  }
  return [...hosts]
}
