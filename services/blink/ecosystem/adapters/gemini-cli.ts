import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

const AT_PATH = /@([^\s@]+)/g

/** Gemini CLI-style @path mentions → file paths relative to cwd. */
export function parseGeminiAtMentions(text: string, cwd: string): string[] {
  const paths: string[] = []
  for (const match of text.matchAll(AT_PATH)) {
    const raw = match[1]!
    if (raw.startsWith('http://') || raw.startsWith('https://')) continue
    const abs = isAbsolute(raw) ? raw : resolve(cwd, raw)
    if (existsSync(abs)) paths.push(abs)
  }
  return [...new Set(paths)]
}

export function expandGeminiFileContext(
  paths: string[],
  options?: { maxCharsPerFile?: number },
): string {
  const max = options?.maxCharsPerFile ?? 8_000
  const blocks: string[] = []
  for (const p of paths) {
    try {
      const body = readFileSync(p, 'utf8')
      const clipped =
        body.length > max ? body.slice(0, max) + '\n…(truncated)' : body
      blocks.push(`### @${p}\n\`\`\`\n${clipped}\n\`\`\``)
    } catch {
      blocks.push(`### @${p}\n(file unreadable)`)
    }
  }
  return blocks.join('\n\n')
}

export function stripGeminiAtMentions(text: string): string {
  return text.replace(AT_PATH, (_, p: string) => `[file:${p}]`)
}

export function formatGeminiCliHelp(): string {
  return [
    '# Gemini CLI patterns',
    '',
    '## @file context (auto-enriched)',
    'Mention `@path/to/file` in prompts — Blink expands file bodies before the model runs.',
    'Paths are resolved relative to the project cwd.',
    '',
    '## URLs & grounding',
    'URLs in goals are flagged for WebFetch / research (see prompt enrich).',
    '',
    '## MCP',
    'Use `/mcp` for Gemini-style tool extensions and grounded actions.',
  ].join('\n')
}
