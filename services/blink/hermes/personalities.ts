import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getBlinkHome } from '../../../scripts/blink-home.js'

export type BlinkPersonality = {
  id: string
  name: string
  description: string
  prompt: string
}

export const BLINK_PERSONALITIES: readonly BlinkPersonality[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Balanced Blink coding agent (no extra persona)',
    prompt: '',
  },
  {
    id: 'concise',
    name: 'Concise',
    description: 'Minimal prose, maximum signal',
    prompt:
      'Be extremely concise. Lead with the answer or diff. Skip preamble, hedging, and step-by-step narration unless the user asks for detail.',
  },
  {
    id: 'thorough',
    name: 'Thorough',
    description: 'Explain trade-offs and verify assumptions',
    prompt:
      'Be thorough but structured: state assumptions, list trade-offs, and verify with tools before claiming success. Prefer short sections over walls of text.',
  },
  {
    id: 'socratic',
    name: 'Socratic',
    description: 'Ask clarifying questions before big changes',
    prompt:
      'When requirements are ambiguous or risky, ask one focused clarifying question before large edits. Do not block trivial fixes.',
  },
  {
    id: 'pair',
    name: 'Pair programmer',
    description: 'Collaborative, teaching-oriented tone',
    prompt:
      'Pair-programming tone: explain the why behind non-obvious choices, suggest alternatives briefly, and keep the user in the loop on architectural decisions.',
  },
] as const

const personalityPath = (): string =>
  join(getBlinkHome(), '.blink', 'personality.json')

type StoredPersonality = { id: string }

function ensureBlinkDir(): void {
  const dir = join(getBlinkHome(), '.blink')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function getBlinkPersonalityById(id: string): BlinkPersonality | undefined {
  return BLINK_PERSONALITIES.find(p => p.id === id)
}

export function getActiveBlinkPersonalityId(): string {
  const path = personalityPath()
  if (!existsSync(path)) return 'default'
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as StoredPersonality
    if (raw.id && getBlinkPersonalityById(raw.id)) return raw.id
  } catch {
    // ignore corrupt file
  }
  return 'default'
}

export function getActiveBlinkPersonality(): BlinkPersonality {
  return (
    getBlinkPersonalityById(getActiveBlinkPersonalityId()) ??
    BLINK_PERSONALITIES[0]!
  )
}

export function setActiveBlinkPersonality(id: string): BlinkPersonality {
  const personality = getBlinkPersonalityById(id)
  if (!personality) {
    throw new Error(
      `Unknown personality "${id}". Try: ${BLINK_PERSONALITIES.map(p => p.id).join(', ')}`,
    )
  }
  ensureBlinkDir()
  writeFileSync(
    personalityPath(),
    JSON.stringify({ id: personality.id }, null, 2),
    'utf8',
  )
  return personality
}

export function formatPersonalityList(): string {
  const active = getActiveBlinkPersonalityId()
  return BLINK_PERSONALITIES.map(p => {
    const mark = p.id === active ? ' (active)' : ''
    return `- **${p.id}** — ${p.name}${mark}: ${p.description}`
  }).join('\n')
}
