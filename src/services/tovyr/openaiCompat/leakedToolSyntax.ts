/** Llama / NIM models sometimes emit fake tool syntax as plain text instead of tool_calls. */
import {
  normalizeToolName,
  parseLooseToolArguments,
} from './toolNormalization.js'

const PYTHON_TAG_RE = /<\|python_tag\|>\s*([\s\S]*?)(?=<\|python_tag\|>|$)/gi
const ORPHAN_TAG_RE = /<\|python_tag\|>/gi

export type RecoveredToolUse = {
  id: string
  name: string
  input: Record<string, unknown>
}

function nextRecoveredId(counter: number): string {
  return `toolu_leak_${Date.now()}_${counter}`
}

function mapLeakedBodyToTool(
  body: string,
  counter: number,
): RecoveredToolUse | null {
  const command = body.trim()
  if (!command) return null

  const echoWrite = command.match(
    /^echo\s+(["'])([\s\S]*)\1\s*>\s*(\S+)\s*$/i,
  )
  if (echoWrite?.[2] && echoWrite[3]) {
    return {
      id: nextRecoveredId(counter),
      name: 'Write',
      input: { file_path: echoWrite[3], content: echoWrite[2] },
    }
  }

  const touchFile = command.match(/^touch\s+(\S+)\s*$/i)
  if (touchFile?.[1]) {
    const filePath = touchFile[1]
    let content = ''
    if (/\.html?$/i.test(filePath)) {
      content =
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Document</title>\n</head>\n<body>\n\n</body>\n</html>\n'
    }
    return {
      id: nextRecoveredId(counter),
      name: 'Write',
      input: { file_path: filePath, content },
    }
  }

  const heredoc = command.match(
    /^cat\s*>\s*(\S+)\s*<<['"]?EOF['"]?[\r\n]+([\s\S]*?)[\r\n]+EOF\s*$/i,
  )
  if (heredoc?.[1] && heredoc[2] !== undefined) {
    return {
      id: nextRecoveredId(counter),
      name: 'Write',
      input: { file_path: heredoc[1], content: heredoc[2] },
    }
  }

  return {
    id: nextRecoveredId(counter),
    name: 'Bash',
    input: { command },
  }
}

/** Strip leaked python_tag tool syntax and recover real tool_use blocks when possible. */
export function recoverLeakedPythonTagTools(text: string): {
  cleanText: string
  toolUses: RecoveredToolUse[]
} {
  if (!text.includes('python_tag')) {
    return { cleanText: text, toolUses: [] }
  }

  const toolUses: RecoveredToolUse[] = []
  let counter = 0

  const cleanText = text
    .replace(PYTHON_TAG_RE, (_full, body: string) => {
      const tool = mapLeakedBodyToTool(body, counter++)
      if (tool) toolUses.push(tool)
      return ''
    })
    .replace(ORPHAN_TAG_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { cleanText, toolUses }
}

export function stripLeakedPythonTagMarkup(text: string): string {
  return recoverLeakedPythonTagTools(text).cleanText
}

/**
 * Many open models emit tool calls as *text* in their own chat-template format
 * rather than via the API's tool_calls field, especially behind OpenAI-compat
 * shims that don't parse the template. We recover the common dialects:
 *   - Llama / functionary:  <function=Write>{ "file_path": "a", ... }</function>
 *   - Qwen / Hermes:        <tool_call>{ "name": "Write", "arguments": { … } }</tool_call>
 *   - Bare object:          { "name": "Write", "arguments": { … } }  (whole message)
 * Names are normalized and arguments are leniently parsed.
 */
const FUNCTION_TAG_RE = /<function=([^>\s]+)\s*>([\s\S]*?)<\/function>/gi
const TOOL_CALL_TAG_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi

/** Dracarys / Llama models often leak `Write file_path=… content=…` as plain chat text. */
const KV_TOOL_HEADER_RE =
  /(?:^|\n)\s*[●•*\-]?\s*(Write|Edit|Read|Bash)\s+([\s\S]*?)(?=(?:\n\s*[●•*\-]?\s*(?:Write|Edit|Read|Bash)\s+)|$)/gi

function unquoteValue(raw: string): string {
  const t = raw.trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1)
  }
  return t
}

function normalizeLeakedFileContent(raw: string): string {
  return raw
    .replace(/^\n+/, '')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .trimEnd()
}

function parseKeyValueToolArgs(
  body: string,
): { name: string; input: Record<string, unknown> } | null {
  const trimmed = body.trim()
  if (!trimmed) return null

  const filePathMatch = trimmed.match(
    /^file_path=(.+?)(?:,\s*|\s+)content=\s*([\s\S]*)$/i,
  )
  if (filePathMatch?.[1]) {
    const rawPath = unquoteValue(filePathMatch[1])
    const file_path = rawPath.split(/[/\\]/).pop() || 'index.html'
    return {
      name: 'Write',
      input: {
        file_path,
        content: normalizeLeakedFileContent(filePathMatch[2] ?? ''),
      },
    }
  }

  const commandMatch = trimmed.match(/^command=\s*([\s\S]*)$/i)
  if (commandMatch?.[1]) {
    return {
      name: 'Bash',
      input: { command: unquoteValue(commandMatch[1].trim()) },
    }
  }

  const readMatch = trimmed.match(/^file_path=\s*(.+)$/i)
  if (readMatch?.[1] && !trimmed.toLowerCase().includes('content=')) {
    return {
      name: 'Read',
      input: { file_path: unquoteValue(readMatch[1]) },
    }
  }

  return null
}

/** Recover `Write file_path=path content=\\nbody` dialect emitted as chat text. */
export function recoverKeyValueToolCalls(text: string): {
  cleanText: string
  toolUses: RecoveredToolUse[]
} {
  if (!/\bfile_path=/i.test(text) && !/\bcommand=/i.test(text)) {
    return { cleanText: text, toolUses: [] }
  }

  const toolUses: RecoveredToolUse[] = []
  const seen = new Set<string>()
  let counter = 0

  const cleanText = text
    .replace(KV_TOOL_HEADER_RE, (_full, toolName: string, body: string) => {
      const parsed = parseKeyValueToolArgs(body)
      if (!parsed) return _full
      const name = normalizeToolName(
        typeof toolName === 'string' ? toolName : parsed.name,
      )
      const input = parsed.input
      const key = `${name}:${JSON.stringify(input)}`
      if (!seen.has(key)) {
        seen.add(key)
        toolUses.push({
          id: nextRecoveredId(counter++),
          name,
          input,
        })
      }
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { cleanText, toolUses }
}

export function stripLeakedKeyValueToolMarkup(text: string): string {
  return recoverKeyValueToolCalls(text).cleanText
}

export function isLeakedKeyValueToolText(text: string): boolean {
  return recoverKeyValueToolCalls(text).toolUses.length > 0
}

function asInputObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function recoverNativeToolCalls(text: string): {
  cleanText: string
  toolUses: RecoveredToolUse[]
} {
  const hasTag = text.includes('<function=') || text.includes('<tool_call')
  const maybeBare = text.trimStart().startsWith('{') && text.includes('"name"')
  if (!hasTag && !maybeBare) {
    return { cleanText: text, toolUses: [] }
  }

  const toolUses: RecoveredToolUse[] = []
  let counter = 0
  let cleanText = text

  // <function=NAME>{ json args }</function>
  cleanText = cleanText.replace(
    FUNCTION_TAG_RE,
    (_full, name: string, body: string) => {
      toolUses.push({
        id: nextRecoveredId(counter++),
        name: normalizeToolName(name.trim()),
        input: parseLooseToolArguments(body),
      })
      return ''
    },
  )

  // <tool_call>{ "name": …, "arguments": { … } }</tool_call>
  cleanText = cleanText.replace(TOOL_CALL_TAG_RE, (_full, body: string) => {
    const obj = parseLooseToolArguments(body)
    const name = typeof obj.name === 'string' ? obj.name : ''
    if (name) {
      toolUses.push({
        id: nextRecoveredId(counter++),
        name: normalizeToolName(name),
        input: asInputObject(obj.arguments ?? obj.parameters ?? obj.input),
      })
    }
    return ''
  })

  // Whole-message bare object: { "name": "Write", "arguments": { … } }
  if (toolUses.length === 0) {
    const trimmed = cleanText.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const obj = parseLooseToolArguments(trimmed)
      const name = typeof obj.name === 'string' ? obj.name : ''
      const args = obj.arguments ?? obj.parameters
      if (name && args && typeof args === 'object' && !Array.isArray(args)) {
        toolUses.push({
          id: nextRecoveredId(counter++),
          name: normalizeToolName(name),
          input: args as Record<string, unknown>,
        })
        cleanText = ''
      }
    }
  }

  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim()
  return { cleanText, toolUses }
}

/** Run all native-text tool recovery passes (deduped by tool name + input). */
export function recoverAllLeakedToolCalls(text: string): {
  cleanText: string
  toolUses: RecoveredToolUse[]
} {
  let cleanText = text
  const merged: RecoveredToolUse[] = []
  const seen = new Set<string>()
  let counter = 0

  const append = (toolUses: RecoveredToolUse[]) => {
    for (const tool of toolUses) {
      const key = `${tool.name}:${JSON.stringify(tool.input)}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push({ ...tool, id: nextRecoveredId(counter++) })
    }
  }

  const kv = recoverKeyValueToolCalls(cleanText)
  cleanText = kv.cleanText
  append(kv.toolUses)

  const native = recoverNativeToolCalls(cleanText)
  cleanText = native.cleanText
  append(native.toolUses)

  const narrated = recoverNarratedFileWrites(cleanText)
  cleanText = narrated.cleanText
  append(narrated.toolUses)

  return { cleanText, toolUses: merged }
}

/**
 * Weak models often "write a file" by dumping its contents into a fenced code
 * block in chat instead of calling the Write tool. The caller invokes this only
 * when a turn would otherwise end with NO tool calls, so anything we recover is
 * strictly better than a file that never lands on disk.
 */

// Default file names per fence language, used only when the model gives a
// language but no explicit filename AND the prose clearly asks to create a file.
const LANG_DEFAULT_FILE: Record<string, string> = {
  html: 'index.html',
  htm: 'index.html',
  css: 'styles.css',
  js: 'script.js',
  javascript: 'script.js',
  jsx: 'App.jsx',
  ts: 'index.ts',
  typescript: 'index.ts',
  tsx: 'App.tsx',
  py: 'main.py',
  python: 'main.py',
  json: 'data.json',
  md: 'README.md',
  markdown: 'README.md',
  sh: 'script.sh',
  bash: 'script.sh',
  yaml: 'config.yaml',
  yml: 'config.yaml',
}

// A token that looks like a file name: has a short extension. Allows paths.
const FILENAME_TOKEN_RE = /[\w./\\-]*[\w-]\.[A-Za-z0-9]{1,12}/g

// Triple-backtick fenced blocks: ```info\n body \n```
const FENCED_BLOCK_RE = /```([^\n]*)\n([\s\S]*?)```/g

const CREATION_INTENT_RE =
  /\b(create|creating|make|made|build|building|generate|generating|write|writing|save|saving|add|adding|scaffold|set up|here'?s|here is|notepad|save\s+as|navigate\s+to)\b/i

function firstFilenameToken(text: string): string | null {
  const matches = text.match(FILENAME_TOKEN_RE)
  if (!matches) return null
  for (const m of matches) {
    // Skip bare extensions like ".html".
    if (/^\.+/.test(m)) continue
    const ext = m.slice(m.lastIndexOf('.') + 1)
    // Skip version-like tokens (e.g. "3.1", "llama-3.1") whose "extension" is
    // all digits — real source files have an alphabetic extension.
    if (/^\d+$/.test(ext)) continue
    return m
  }
  return null
}

function deriveFileName(
  info: string,
  precedingText: string,
  intent: boolean,
  substantial: boolean,
): string | null {
  // 1. The fence info string itself names a file, e.g. ```index.html or ```html:src/app.js
  const infoFile = firstFilenameToken(info)
  if (infoFile) return infoFile

  // 2. A filename appears in the last couple of lines before the fence.
  const tail = precedingText.split('\n').slice(-3).join('\n')
  const nearFile = firstFilenameToken(tail)
  if (nearFile) return nearFile

  // 3. Weakest signal: fall back to a language default. Only do this when the
  //    prose clearly asks to create a file AND the block is non-trivial, so we
  //    do not turn small illustrative snippets into files.
  if (intent && substantial) {
    const lang = info.trim().split(/[\s:]/)[0]?.toLowerCase() ?? ''
    if (lang && LANG_DEFAULT_FILE[lang]) return LANG_DEFAULT_FILE[lang]
  }

  return null
}

/**
 * Convert chat-only fenced file output into Write tool_use blocks. Returns the
 * text with consumed blocks removed and the recovered Write calls.
 */
export function recoverNarratedFileWrites(text: string): {
  cleanText: string
  toolUses: RecoveredToolUse[]
} {
  if (!text.includes('```')) {
    return { cleanText: text, toolUses: [] }
  }

  const intent = CREATION_INTENT_RE.test(text)
  const toolUses: RecoveredToolUse[] = []
  let counter = 0
  let lastIndex = 0
  let cleanText = ''

  for (const match of text.matchAll(FENCED_BLOCK_RE)) {
    const full = match[0]
    const info = match[1] ?? ''
    const body = (match[2] ?? '').replace(/\n$/, '')
    const start = match.index ?? 0
    const preceding = text.slice(0, start)

    // A block is "substantial" if it spans multiple lines or is reasonably
    // long; trivial one-liners only become files when explicitly named.
    const isSubstantial = body.includes('\n') || body.trim().length > 40
    const fileName = deriveFileName(info, preceding, intent, isSubstantial)

    if (fileName) {
      toolUses.push({
        id: nextRecoveredId(counter++),
        name: 'Write',
        input: { file_path: fileName, content: body },
      })
      // Drop the consumed block from the visible text.
      cleanText += text.slice(lastIndex, start)
      lastIndex = start + full.length
    }
  }

  cleanText += text.slice(lastIndex)
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim()

  return { cleanText, toolUses }
}
