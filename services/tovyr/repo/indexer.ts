import { readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import type { ImportEdge, RepoIndex, RepoSymbol } from './types.js'

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_DIRS = /(?:^|[\\/])(node_modules|\.git|dist|build|coverage)(?:[\\/]|$)/

const EXPORT_FN = /export\s+(?:async\s+)?function\s+(\w+)/g
const EXPORT_CONST = /export\s+const\s+(\w+)/g
const EXPORT_ENUM = /export\s+enum\s+(\w+)/g
const METHOD_LINE = /^\s+(?:public |private |protected |static |async )*(\w+)\s*\([^)]*\)\s*[:{]/gm
const EXPORT_CLASS = /export\s+class\s+(\w+)/g
const EXPORT_TYPE = /export\s+(?:type|interface)\s+(\w+)/g
const NAMED_EXPORT = /export\s*\{\s*([^}]+)\s*\}/g
const IMPORT_LINE = /^\s*import\s+(?:type\s+)?(?:[\w*{}\s,]+from\s+)?['"]([^'"]+)['"]/gm
const FUNCTION_DECL = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm
const CLASS_DECL = /^(?:export\s+)?class\s+(\w+)/gm

function shouldIndexFile(relPath: string): boolean {
  if (SKIP_DIRS.test(relPath)) return false
  return SOURCE_EXT.test(relPath)
}

function extractSymbols(content: string, file: string): RepoSymbol[] {
  const symbols: RepoSymbol[] = []
  const lines = content.split('\n')

  const scan = (regex: RegExp, kind: RepoSymbol['kind']) => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      const re = new RegExp(regex.source, regex.flags)
      while ((m = re.exec(line))) {
        symbols.push({ name: m[1]!, kind, file, line: i + 1 })
      }
    }
  }

  scan(EXPORT_FN, 'function')
  scan(EXPORT_CONST, 'const')
  scan(EXPORT_ENUM, 'enum')
  scan(EXPORT_CLASS, 'class')
  scan(EXPORT_TYPE, 'type')
  scan(FUNCTION_DECL, 'function')
  scan(CLASS_DECL, 'class')

  METHOD_LINE.lastIndex = 0
  let methodMatch: RegExpExecArray | null
  while ((methodMatch = METHOD_LINE.exec(content))) {
    const line = content.slice(0, methodMatch.index).split('\n').length
    symbols.push({ name: methodMatch[1]!, kind: 'function', file, line })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    NAMED_EXPORT.lastIndex = 0
    const m = NAMED_EXPORT.exec(line)
    if (m) {
      for (const part of m[1]!.split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0]?.trim()
        if (name && /^\w+$/.test(name)) {
          symbols.push({ name, kind: 'export', file, line: i + 1 })
        }
      }
    }
  }

  return symbols
}

function extractImports(content: string, file: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    IMPORT_LINE.lastIndex = 0
    const m = IMPORT_LINE.exec(line)
    if (m) {
      edges.push({ from: file, to: m[1]!, line: i + 1 })
    }
  }
  return edges
}

export type IndexFileFn = (relPath: string) => string | null

/** Build a repo index from a list of relative file paths. */
export function buildRepoIndex(
  cwd: string,
  filePaths: string[],
  readFile: IndexFileFn = rel => {
    try {
      return readFileSync(join(cwd, rel), 'utf8')
    } catch {
      return null
    }
  },
): RepoIndex {
  const files = filePaths.filter(shouldIndexFile)
  const symbols: RepoSymbol[] = []
  const imports: ImportEdge[] = []

  for (const file of files) {
    const content = readFile(file)
    if (!content) continue
    symbols.push(...extractSymbols(content, file))
    imports.push(...extractImports(content, file))
  }

  return {
    cwd,
    files,
    symbols,
    imports,
    indexedAt: Date.now(),
  }
}

export function summarizeIndex(index: RepoIndex): string {
  const byKind = new Map<string, number>()
  for (const s of index.symbols) {
    byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + 1)
  }
  const topFiles = [...index.files]
    .map(f => ({
      f,
      count: index.symbols.filter(s => s.file === f).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return [
    `Repository index (${relative(index.cwd, index.cwd) || index.cwd})`,
    `Files: ${index.files.length}`,
    `Symbols: ${index.symbols.length}`,
    `Import edges: ${index.imports.length}`,
    '',
    'Symbols by kind:',
    ...[...byKind.entries()].map(([k, v]) => `- ${k}: ${v}`),
    '',
    'Top files by symbol count:',
    ...topFiles.map(t => `- ${t.f} (${t.count})`),
  ].join('\n')
}

export function getIndexAgeMs(index: RepoIndex): number {
  return Date.now() - index.indexedAt
}

export function isIndexStale(index: RepoIndex, maxAgeMs = 5 * 60 * 1000): boolean {
  return getIndexAgeMs(index) > maxAgeMs
}

/** For tests — check file mtime without full reindex. */
export function fileMtime(cwd: string, relPath: string): number | null {
  try {
    return statSync(join(cwd, relPath)).mtimeMs
  } catch {
    return null
  }
}
