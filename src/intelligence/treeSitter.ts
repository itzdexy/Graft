/**
 * Tree-sitter–style code parsing (Aider pattern).
 * Uses regex/heuristic extraction; bash uses native tree-sitter elsewhere.
 */

export interface ParsedSymbol {
  name: string
  kind: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable'
  line: number
  signature?: string
}

export interface ParsedImport {
  module: string
  names: string[]
  line: number
  isDefault: boolean
}

const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
}

export function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return EXT_LANG[ext] ?? 'unknown'
}

export function parseSymbols(content: string, language: string): ParsedSymbol[] {
  const symbols: ParsedSymbol[] = []
  const lines = content.split('\n')

  if (language === 'typescript' || language === 'javascript') {
    const fnRe =
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(|^(\w+)\s*\([^)]*\)\s*[:{]/gm
    const classRe = /^(?:export\s+)?class\s+(\w+)/gm
    let m: RegExpExecArray | null
    while ((m = fnRe.exec(content))) {
      const name = m[1] ?? m[2] ?? m[3]
      if (name && !['if', 'for', 'while', 'switch'].includes(name)) {
        symbols.push({
          name,
          kind: 'function',
          line: content.slice(0, m.index).split('\n').length,
        })
      }
    }
    while ((m = classRe.exec(content))) {
      symbols.push({
        name: m[1]!,
        kind: 'class',
        line: content.slice(0, m.index).split('\n').length,
      })
    }
    const ifaceRe = /^(?:export\s+)?interface\s+(\w+)/gm
    while ((m = ifaceRe.exec(content))) {
      symbols.push({
        name: m[1]!,
        kind: 'interface',
        line: content.slice(0, m.index).split('\n').length,
      })
    }
  } else if (language === 'python') {
    let i = 0
    for (const line of lines) {
      i++
      const def = line.match(/^def\s+(\w+)/)
      if (def) symbols.push({ name: def[1]!, kind: 'function', line: i })
      const cls = line.match(/^class\s+(\w+)/)
      if (cls) symbols.push({ name: cls[1]!, kind: 'class', line: i })
    }
  } else if (language === 'rust') {
    let i = 0
    for (const line of lines) {
      i++
      const fn = line.match(/^(?:pub\s+)?fn\s+(\w+)/)
      if (fn) symbols.push({ name: fn[1]!, kind: 'function', line: i })
      const st = line.match(/^(?:pub\s+)?struct\s+(\w+)/)
      if (st) symbols.push({ name: st[1]!, kind: 'class', line: i })
    }
  }

  return symbols
}

export function parseImports(content: string, language: string): ParsedImport[] {
  const imports: ParsedImport[] = []
  const lines = content.split('\n')

  if (language === 'typescript' || language === 'javascript') {
    let i = 0
    for (const line of lines) {
      i++
      const from = line.match(/import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/)
      if (from) {
        imports.push({
          module: from[3]!,
          names: from[1]
            ? from[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]!)
            : [from[2]!],
          line: i,
          isDefault: Boolean(from[2] && !from[1]),
        })
      }
    }
  } else if (language === 'python') {
    let i = 0
    for (const line of lines) {
      i++
      const m = line.match(/^from\s+(\S+)\s+import\s+(.+)/)
      if (m) {
        imports.push({
          module: m[1]!,
          names: m[2]!.split(',').map(s => s.trim()),
          line: i,
          isDefault: false,
        })
      }
    }
  }

  return imports
}

export function formatSymbolOutline(
  filePath: string,
  content: string,
): string {
  const lang = detectLanguageFromPath(filePath)
  const symbols = parseSymbols(content, lang)
  if (!symbols.length) return ''
  const header = `## ${filePath}`
  const body = symbols
    .map(s => `  L${s.line} ${s.kind} ${s.name}`)
    .join('\n')
  return `${header}\n${body}`
}
