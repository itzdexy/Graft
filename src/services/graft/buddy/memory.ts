import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { getGraftHome } from '../../../../scripts/graft-home.js'
import { writeJsonAtomic } from '../fsSafe.js'
import { clearMemorySearchCache } from './memoryCache.js'

export type GraftProjectMemory = {
  projectName: string
  goals: string[]
  architecture: string[]
  decisions: string[]
  roadmap: string[]
  codingStandards: string[]
  updatedAt: number
}

// A factory, NOT a shared constant: every memory must own its own arrays.
// Spreading a shared object ({ ...DEFAULT_MEMORY }) copies array references, so
// a single shared default would let one project's in-place mutation leak into
// the default and into every other freshly-loaded memory.
function defaultMemory(projectName = ''): GraftProjectMemory {
  return {
    projectName,
    goals: [],
    architecture: [],
    decisions: [],
    roadmap: [],
    codingStandards: [],
    updatedAt: Date.now(),
  }
}

function projectNameFromCwd(cwd: string): string {
  return cwd.split(/[/\\]/).pop() || 'Project'
}

/** Coerce an unknown value into a clean string[] (drops non-strings/blanks). */
function coerceList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

/**
 * Build a fully-validated memory from arbitrary parsed JSON. An old or
 * hand-edited file may be missing categories or hold the wrong types; without
 * this, e.g. `{"goals":"x"}` would later make `[...memory.goals]` spread a
 * string into characters.
 */
function normalizeMemory(raw: unknown, cwd: string): GraftProjectMemory {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >
  return {
    projectName:
      typeof obj.projectName === 'string' && obj.projectName
        ? obj.projectName
        : projectNameFromCwd(cwd),
    goals: coerceList(obj.goals),
    architecture: coerceList(obj.architecture),
    decisions: coerceList(obj.decisions),
    roadmap: coerceList(obj.roadmap),
    codingStandards: coerceList(obj.codingStandards),
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
  }
}

function memoryDir(): string {
  return join(getGraftHome(), '.graft')
}

function memoryPath(cwd: string): string {
  const slug = cwd.replace(/[^a-zA-Z0-9]+/g, '_').slice(-80) || 'default'
  return join(memoryDir(), `memory-${slug}.json`)
}

export function loadProjectMemory(cwd: string): GraftProjectMemory {
  const path = memoryPath(cwd)
  if (!existsSync(path)) {
    return defaultMemory(projectNameFromCwd(cwd))
  }
  try {
    return normalizeMemory(JSON.parse(readFileSync(path, 'utf8')), cwd)
  } catch {
    return defaultMemory(projectNameFromCwd(cwd))
  }
}

export function saveProjectMemory(cwd: string, memory: GraftProjectMemory): void {
  const dir = memoryDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeJsonAtomic(
    memoryPath(cwd),
    { ...memory, updatedAt: Date.now() },
    { mode: 0o600 },
  )
}

export type MemoryCategory =
  | 'goals'
  | 'architecture'
  | 'decisions'
  | 'roadmap'
  | 'codingStandards'

export function rememberProjectFact(
  cwd: string,
  category: MemoryCategory,
  fact: string,
): GraftProjectMemory {
  const trimmed = fact.trim()
  if (!trimmed) {
    return loadProjectMemory(cwd)
  }
  const memory = loadProjectMemory(cwd)
  const list = [...memory[category]]
  if (!list.includes(trimmed)) {
    list.push(trimmed)
  }
  const next = { ...memory, [category]: list }
  saveProjectMemory(cwd, next)
  clearMemorySearchCache(cwd)
  return next
}

export function removeProjectFact(
  cwd: string,
  category: MemoryCategory,
  index: number,
): { memory: GraftProjectMemory; removed?: string } {
  const memory = loadProjectMemory(cwd)
  const list = [...memory[category]]
  if (index < 0 || index >= list.length) {
    return { memory }
  }
  const removed = list.splice(index, 1)[0]
  const next = { ...memory, [category]: list }
  saveProjectMemory(cwd, next)
  clearMemorySearchCache(cwd)
  return { memory: next, removed }
}

/** Parse "## Memory updates" bullets from assistant output and merge into project memory. */
export function mergeMemoryUpdatesFromText(
  cwd: string,
  text: string,
): { updated: boolean; count: number } {
  let count = 0
  let inSection = false
  for (const line of text.split('\n')) {
    if (/^\s*##\s*Memory updates\b/i.test(line)) {
      inSection = true
      continue
    }
    if (!inSection) continue
    // Any other heading ends the Memory updates section, so bullets under a
    // later "## Next steps" (etc.) are never merged as project memory.
    if (/^\s*##\s/.test(line)) break

    const m = line.match(
      /^[-*]\s*(goals?|architecture|decisions?|roadmap|coding standards?):\s*(.+)$/i,
    )
    if (!m) continue
    const rawCat = m[1]!.toLowerCase()
    const fact = m[2]!.trim()
    let category: MemoryCategory | null = null
    if (rawCat.startsWith('goal')) category = 'goals'
    else if (rawCat.startsWith('architect')) category = 'architecture'
    else if (rawCat.startsWith('decision')) category = 'decisions'
    else if (rawCat.startsWith('roadmap')) category = 'roadmap'
    else if (rawCat.startsWith('coding')) category = 'codingStandards'
    if (category && fact) {
      rememberProjectFact(cwd, category, fact)
      count++
    }
  }
  return { updated: count > 0, count }
}

export function formatMemoryForPrompt(memory: GraftProjectMemory): string {
  const sections: string[] = []
  if (memory.goals.length) {
    sections.push(`Goals:\n${memory.goals.map(g => `- ${g}`).join('\n')}`)
  }
  if (memory.architecture.length) {
    sections.push(
      `Architecture:\n${memory.architecture.map(a => `- ${a}`).join('\n')}`,
    )
  }
  if (memory.decisions.length) {
    sections.push(
      `Decisions:\n${memory.decisions.map(d => `- ${d}`).join('\n')}`,
    )
  }
  if (memory.roadmap.length) {
    sections.push(`Roadmap:\n${memory.roadmap.map(r => `- ${r}`).join('\n')}`)
  }
  if (memory.codingStandards.length) {
    sections.push(
      `Coding standards:\n${memory.codingStandards.map(c => `- ${c}`).join('\n')}`,
    )
  }
  if (!sections.length) return ''
  return `# Graft Buddy project memory (${memory.projectName})\n\n${sections.join('\n\n')}`
}

export type MemoryEntry = {
  category: MemoryCategory
  text: string
}

/** Flatten project memory into searchable entries. */
export function listMemoryEntries(memory: GraftProjectMemory): MemoryEntry[] {
  const categories: MemoryCategory[] = [
    'goals',
    'architecture',
    'decisions',
    'roadmap',
    'codingStandards',
  ]
  const entries: MemoryEntry[] = []
  for (const category of categories) {
    for (const text of memory[category]) {
      entries.push({ category, text })
    }
  }
  return entries
}

function scoreMemoryEntry(text: string, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const lower = text.toLowerCase()
  if (lower === q) return 100
  if (lower.includes(q)) return 50 + Math.min(q.length, 30)
  const words = q.split(/\s+/).filter(Boolean)
  const matched = words.filter(w => lower.includes(w)).length
  return matched > 0 ? (matched / words.length) * 40 : 0
}

export function searchProjectMemory(
  memory: GraftProjectMemory,
  query: string,
  limit = 20,
): MemoryEntry[] {
  return listMemoryEntries(memory)
    .map(e => ({ e, score: scoreMemoryEntry(e.text, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.e)
}

export function clearProjectMemory(cwd: string): GraftProjectMemory {
  const empty = defaultMemory(projectNameFromCwd(cwd))
  saveProjectMemory(cwd, empty)
  clearMemorySearchCache(cwd)
  return empty
}

export function formatMemoryList(memory: GraftProjectMemory): string {
  const entries = listMemoryEntries(memory)
  if (!entries.length) {
    return `No project memory for "${memory.projectName}". Use /buddy remember or ## Memory updates in agent sessions.`
  }
  const lines = [`# Project memory — ${memory.projectName}`, '']
  let lastCat: MemoryCategory | null = null
  for (const { category, text } of entries) {
    if (category !== lastCat) {
      lines.push(`## ${category}`)
      lastCat = category
    }
    lines.push(`- ${text}`)
  }
  return lines.join('\n')
}

export function formatMemorySearchResults(
  query: string,
  hits: MemoryEntry[],
): string {
  if (!hits.length) return `No memory entries matching "${query}".`
  return [
    `# Memory search: "${query}"`,
    '',
    ...hits.map(h => `- [${h.category}] ${h.text}`),
  ].join('\n')
}
