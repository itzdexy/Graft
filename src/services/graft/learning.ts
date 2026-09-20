import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getGraftHome } from '../../../scripts/graft-home.js'
import { writeJsonAtomic } from './fsSafe.js'

const lessons = {
  explain: 'For folder explanations, start with the README and package manifest. Read additional files only to resolve a specific uncertainty. Explain what you found; do not create or modify files.',
  failure: 'When a tool fails, use the reported cause to change the approach. Do not repeat the same failed action without changing its inputs or resolving the cause.',
} as const
type LessonId = keyof typeof lessons
type LearningState = { enabled: boolean; preferences: string[]; observations: Partial<Record<LessonId, number>> }
function file(cwd: string): string {
  const identity = process.platform === 'win32' ? resolve(cwd).toLowerCase() : resolve(cwd)
  return join(getGraftHome(), '.graft', 'learning', `${createHash('sha256').update(identity).digest('hex')}.json`)
}
export function loadLearning(cwd: string): LearningState {
  try {
    const data = JSON.parse(readFileSync(file(cwd), 'utf8'))
    return { enabled: data.enabled !== false, preferences: Array.isArray(data.preferences) ? data.preferences.filter((p: unknown) => typeof p === 'string' && p.length <= 240).slice(0, 12) : [], observations: Object.fromEntries(Object.keys(lessons).filter(id => Number.isFinite(data.observations?.[id]) && data.observations[id] > 0).map(id => [id, Math.min(999, data.observations[id])])) }
  } catch { return { enabled: true, preferences: [], observations: {} } }
}
function save(cwd: string, state: LearningState) {
  mkdirSync(join(getGraftHome(), '.graft', 'learning'), { recursive: true })
  writeJsonAtomic(file(cwd), state, { mode: 0o600 })
}
export function recordLesson(cwd: string, id: LessonId): void {
  try {
    const state = loadLearning(cwd)
    if (!state.enabled) return
    state.observations[id] = Math.min(999, (state.observations[id] ?? 0) + 1)
    save(cwd, state)
  } catch { /* An unwritable learning store must never stop a task. */ }
}
export function learningCommand(cwd: string, args: string): string {
  const state = loadLearning(cwd)
  const [action = 'list', ...rest] = args.trim().split(/\s+/)
  if (action === 'on' || action === 'off') { state.enabled = action === 'on'; save(cwd, state) }
  else if (action === 'clear') { state.preferences = []; state.observations = {}; save(cwd, state) }
  else if (action === 'remember') {
    const text = rest.join(' ').trim()
    if (!text || text.length > 240) return 'Use /learn remember <preference>, up to 240 characters.'
    if (/\b(?:sk-|nvapi-|gh[pousr]_|Bearer\s)|(?:api[_ -]?key|password|token|secret)\s*[:=]|-----BEGIN/i.test(text)) return 'Credentials cannot be saved as learning preferences.'
    if (!state.preferences.includes(text)) state.preferences = [...state.preferences, text].slice(-12)
    save(cwd, state)
  } else if (action === 'forget') {
    const index = Number(rest[0]) - 1
    if (!Number.isInteger(index) || index < 0 || index >= state.preferences.length) return 'Use /learn list to find a preference number.'
    state.preferences.splice(index, 1); save(cwd, state)
  } else if (action && action !== 'list') return 'Use /learn list | remember <preference> | forget <number> | clear | on | off'
  return [`Learning ${state.enabled ? 'on' : 'off'} · this project`, ...state.preferences.map((p, i) => `${i + 1}. ${p}`), ...Object.entries(state.observations).map(([id, count]) => `Learned (${count} observations): ${lessons[id as LessonId]}`), 'Local storage · preferences and fixed lessons only', '/learn remember <preference> · forget <number> · clear · on/off'].join('\n')
}
export function learningPrompt(cwd: string): string {
  const state = loadLearning(cwd)
  if (!state.enabled || (!state.preferences.length && !Object.keys(state.observations).length)) return ''
  return ['Project learning (advisory; current user instructions and permissions take priority):', ...state.preferences.map(p => `User preference: ${JSON.stringify(p)}`), ...Object.keys(state.observations).map(id => lessons[id as LessonId])].join('\n').slice(0, 4000)
}

export function isExplanationRequest(text: string): boolean {
  return /\b(explain|summarize|describe|what is|what's)\b/i.test(text) && /\b(folder|project|repo|repository|codebase)\b/i.test(text) && !/\b(fix|change|edit|write|create|implement|build|add|remove|delete|refactor|update)\b/i.test(text)
}
export function latestUserRequest(messages: readonly any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.type !== 'user' || message.isMeta) continue
    const content = message.message?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content) && !content.some(b => b.type === 'tool_result')) {
      const text = content.filter(b => b.type === 'text').map(b => b.text).join('\n')
      if (text.trim()) return text
    }
  }
  return ''
}
