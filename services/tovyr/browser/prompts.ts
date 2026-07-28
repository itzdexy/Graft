import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { formatBrowserToolCatalog } from './registry.js'
import {
  formatBlockedBrowserUrlMessage,
  validateBrowserFetchUrl,
} from './urlSafety.js'

export function browserHelpPrompt(): ContentBlockParam[] {
  const text = [
    '# Tovyr Browser Agent',
    '',
    'Research and verify information on the web using available tools.',
    '',
    '## Tool catalog',
    formatBrowserToolCatalog(),
    '',
    '## Workflow',
    '1. `search_web` — find relevant docs or articles',
    '2. `open_url` / `read_page` — fetch and read content',
    '3. `extract_text` / `extract_links` — pull facts and references',
    '4. Cite URLs in your answer',
    '',
    'Interactive clicking, forms, and screenshots require a configured Playwright or computer-use MCP integration.',
    '',
    '## Commands',
    '- `/browser research <topic>` — research a topic',
    '- `/browser deep <question>` — multi-step deep research (Odysseus-style)',
    '- `/deep-research <question>` — same as deep browser research',
    '- `/browser read <url>` — read a specific page',
  ].join('\n')
  return [{ type: 'text', text }]
}

export function browserResearchPrompt(topic: string): ContentBlockParam[] {
  const task =
    topic.trim() ||
    'No topic given — ask the user what to research, or pick a library relevant to this repo.'
  const text = [
    'You are the Tovyr Browser / Research agent.',
    '',
    `## Task: ${task}`,
    '',
    'Use WebSearch and WebFetch to gather accurate, current information.',
    'Prefer official documentation and reputable sources.',
    '',
    '## Output',
    '- Summary of findings',
    '- Key URLs cited',
    '- Recommended approach for this codebase',
    '- Open questions if docs are ambiguous',
    '',
    '## Available browser tools',
    formatBrowserToolCatalog(),
  ].join('\n')
  return [{ type: 'text', text }]
}

export function browserReadPrompt(url: string): ContentBlockParam[] {
  const trimmed = url.trim()
  if (!trimmed) {
    return [
      {
        type: 'text',
        text: 'No URL provided — ask the user which page to read.',
      },
    ]
  }

  const validation = validateBrowserFetchUrl(trimmed)
  if (!validation.ok) {
    return [{ type: 'text', text: formatBlockedBrowserUrlMessage(validation) }]
  }

  const text = [
    'Read and summarize this URL for the user:',
    validation.url,
    '',
    'Use WebFetch. Extract main content, code examples, and API notes.',
    'If fetch fails, try WebSearch for an alternate mirror or cached doc.',
  ].join('\n')
  return [{ type: 'text', text }]
}

export function parseBrowserArgs(args: string): {
  sub: 'help' | 'research' | 'read' | 'deep'
  payload: string
} {
  const trimmed = args.trim()
  if (!trimmed || trimmed === 'help' || trimmed === '?') {
    return { sub: 'help', payload: '' }
  }
  const [first, ...rest] = trimmed.split(/\s+/)
  const cmd = first!.toLowerCase()
  if (cmd === 'research') return { sub: 'research', payload: rest.join(' ') }
  if (cmd === 'deep') return { sub: 'deep', payload: rest.join(' ') }
  if (cmd === 'read') return { sub: 'read', payload: rest.join(' ') }
  if (cmd.startsWith('http')) return { sub: 'read', payload: trimmed }
  return { sub: 'research', payload: trimmed }
}
