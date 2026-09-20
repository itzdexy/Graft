/**
 * Comment-based task triggering (Aider pattern).
 * Scans TODO/FIXME/AI/GRAFT comments and can auto-submit as agent tasks.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface CommentTask {
  file: string
  line: number
  kind: 'todo' | 'fixme' | 'ai' | 'graft' | 'hack'
  text: string
  priority: 'low' | 'medium' | 'high'
}

const TASK_RE =
  /\/\/\s*(TODO|FIXME|HACK|AI|GRAFT)[\s:.-]*(.*)|#\s*(TODO|FIXME|HACK|AI|GRAFT)[\s:.-]*(.*)/gi

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
])

export function extractTasksFromLine(
  line: string,
  file: string,
  lineNum: number,
): CommentTask | null {
  const m =
    line.match(/\/\/\s*(TODO|FIXME|HACK|AI|GRAFT)[\s:.-]*(.*)/i) ??
    line.match(/#\s*(TODO|FIXME|HACK|AI|GRAFT)[\s:.-]*(.*)/i)
  if (!m) return null
  const kind = m[1]!.toLowerCase() as CommentTask['kind']
  const text = (m[2] ?? m[4] ?? '').trim()
  const priority: CommentTask['priority'] =
    kind === 'fixme' || kind === 'hack' ? 'high' : kind === 'graft' || kind === 'ai' ? 'medium' : 'low'
  return { file, line: lineNum, kind, text, priority }
}

export function scanFileForTasks(filePath: string): CommentTask[] {
  const tasks: CommentTask[] = []
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return tasks
  }
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = extractTasksFromLine(lines[i]!, filePath, i + 1)
    if (t) tasks.push(t)
  }
  return tasks
}

export function scanProjectForTasks(
  root: string,
  opts?: { maxFiles?: number },
): CommentTask[] {
  const maxFiles = opts?.maxFiles ?? 500
  const tasks: CommentTask[] = []
  let scanned = 0

  function walk(dir: string): void {
    if (scanned >= maxFiles) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (scanned >= maxFiles) break
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(full)
      } else if (/\.(ts|tsx|js|jsx|py|rs|go|java|md)$/i.test(name)) {
        scanned++
        tasks.push(...scanFileForTasks(full))
      }
    }
  }

  walk(root)
  return tasks.sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 }
    return pri[a.priority] - pri[b.priority]
  })
}

export function formatTasksForPrompt(tasks: CommentTask[], cwd: string): string {
  if (!tasks.length) return ''
  const lines = tasks.slice(0, 30).map(t => {
    const rel = relative(cwd, t.file)
    return `- [${t.kind.toUpperCase()}] ${rel}:${t.line} — ${t.text}`
  })
  return ['# Comment-triggered tasks (Aider-style)', '', ...lines].join('\n')
}

/** Build agent prompt from highest-priority comment task. */
export function promptFromTopTask(tasks: CommentTask[], cwd: string): string | null {
  const top = tasks.find(t => t.kind === 'graft' || t.kind === 'ai') ?? tasks[0]
  if (!top) return null
  const rel = relative(cwd, top.file)
  return `Implement the ${top.kind.toUpperCase()} at ${rel}:${top.line}: ${top.text}`
}
