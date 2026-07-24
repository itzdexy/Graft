import { normalizeEditToolArguments } from '../edits/normalizeEditInput.js'

/**
 * Weak OpenAI-compatible models (Llama/NIM, vLLM, Ollama, …) frequently call a
 * tool by a near-miss name (`write_file` instead of `Write`, `shell` instead of
 * `Bash`) and emit slightly-malformed argument JSON. Left untouched, the first
 * produces a "tool not found" error and the second silently drops every
 * argument. Both helpers below recover the model's intent before it reaches the
 * agent loop.
 */

// Alias → canonical Blink tool name. Keys are normalized (lowercased,
// non-alphanumerics stripped) before lookup, so `str-replace-editor`,
// `str_replace_editor`, and `strReplaceEditor` all collapse to one key.
const TOOL_ALIASES: Record<string, string> = {
  // Write
  write: 'Write',
  writefile: 'Write',
  writetofile: 'Write',
  filewrite: 'Write',
  createfile: 'Write',
  newfile: 'Write',
  savefile: 'Write',
  putfile: 'Write',
  // Edit
  edit: 'Edit',
  editfile: 'Edit',
  fileedit: 'Edit',
  strreplace: 'Edit',
  strreplaceeditor: 'Edit',
  searchreplace: 'Edit',
  replaceinfile: 'Edit',
  applypatch: 'Edit',
  applydiff: 'Edit',
  patchfile: 'Edit',
  // Read
  read: 'Read',
  readfile: 'Read',
  fileread: 'Read',
  openfile: 'Read',
  viewfile: 'Read',
  catfile: 'Read',
  // Bash
  bash: 'Bash',
  shell: 'Bash',
  sh: 'Bash',
  runshell: 'Bash',
  runcommand: 'Bash',
  runbash: 'Bash',
  execcommand: 'Bash',
  shellcommand: 'Bash',
  terminal: 'Bash',
  // PowerShell
  powershell: 'PowerShell',
  pwsh: 'PowerShell',
  // Grep
  grep: 'Grep',
  ripgrep: 'Grep',
  searchtext: 'Grep',
  searchcode: 'Grep',
  codesearch: 'Grep',
  // Glob
  glob: 'Glob',
  globfiles: 'Glob',
  findfiles: 'Glob',
  fileglob: 'Glob',
  // Web
  webfetch: 'WebFetch',
  fetchurl: 'WebFetch',
  websearch: 'WebSearch',
}

function aliasKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Map a model-supplied tool name onto its canonical Blink name when it is a
 * known alias. MCP tool names (which contain `__`) and anything unrecognized
 * pass through unchanged. Idempotent: canonical names map to themselves.
 */
export function normalizeToolName(name: string): string {
  if (!name) return name
  // Never rewrite namespaced MCP tools like `mcp__server__action`.
  if (name.includes('__')) return name
  return TOOL_ALIASES[aliasKey(name)] ?? name
}

/**
 * Parse tool-call arguments that may be malformed. Tries strict JSON first, then
 * a series of conservative repairs for the mistakes weak models actually make.
 * Always returns an object (never throws); falls back to {} only when nothing
 * parseable can be recovered.
 */
export function parseLooseToolArguments(raw: string | undefined | null): Record<string, unknown> {
  if (raw == null) return {}
  const trimmed = String(raw).trim()
  if (!trimmed) return {}

  const attempts: string[] = []
  attempts.push(trimmed)

  // 1. Strip a surrounding markdown code fence: ```json … ``` or ``` … ```
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced?.[1]) attempts.push(fenced[1].trim())

  // 2. Slice to the outermost {...} when the model wrapped JSON in prose.
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(trimmed.slice(firstBrace, lastBrace + 1))
  }

  for (const candidate of attempts) {
    const parsed = tryParse(candidate)
    if (parsed) return parsed
    const repaired = tryParse(repairJson(candidate))
    if (repaired) return repaired
  }

  return {}
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Conservative, non-destructive repairs for common malformed-JSON patterns. */
function repairJson(text: string): string {
  return escapeControlCharsInStrings(
    text
      // Normalize smart quotes that some models emit.
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      // Remove trailing commas before a closing brace/bracket.
      .replace(/,\s*([}\]])/g, '$1'),
  )
}

/**
 * Escape raw control characters (newlines, tabs, carriage returns) that appear
 * INSIDE JSON string literals. Weak models routinely write multi-line file
 * content with literal newlines, which is invalid JSON; this is the single most
 * common reason a Write call's `content` would otherwise be lost. A tiny
 * state machine tracks string context so structural whitespace is untouched.
 */
function escapeControlCharsInStrings(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        out += ch
        escaped = false
      } else if (ch === '\\') {
        out += ch
        escaped = true
      } else if (ch === '"') {
        out += ch
        inString = false
      } else if (ch === '\n') {
        out += '\\n'
      } else if (ch === '\r') {
        out += '\\r'
      } else if (ch === '\t') {
        out += '\\t'
      } else {
        out += ch
      }
    } else {
      out += ch
      if (ch === '"') inString = true
    }
  }
  return out
}

function coerceWriteString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Normalize tool arguments after JSON parse and before Zod validation. */
export function normalizeToolArguments(
  toolName: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const canonical = normalizeToolName(toolName)
  if (canonical === 'Edit') {
    return normalizeEditToolArguments(raw)
  }
  if (canonical === 'Write') {
    const out = { ...raw }
    if (!out.file_path) {
      const path = out.path ?? out.filePath ?? out.filename
      if (path !== undefined) out.file_path = coerceWriteString(path)
    }
    if (out.content !== undefined) {
      out.content = coerceWriteString(out.content)
    } else if (out.text !== undefined) {
      out.content = coerceWriteString(out.text)
    } else if (out.body !== undefined) {
      out.content = coerceWriteString(out.body)
    }
    return out
  }
  if (canonical === 'Read') {
    const out = { ...raw }
    if (!out.file_path) {
      const path = out.path ?? out.filePath ?? out.filename
      if (path !== undefined) out.file_path = coerceWriteString(path)
    }
    return out
  }
  return raw
}
