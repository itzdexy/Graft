import {
  CRITIQUE_PAIRS,
  DEFAULT_PAIR,
  DEFAULT_ROUNDS,
  MAX_ROUNDS,
  MIN_ROUNDS,
  type CritiquePairId,
} from './modes.js'

export type ParsedCritiqueArgs = {
  pair: CritiquePairId
  rounds: number
  task: string
}

function parseRounds(token: string): number | null {
  const m = token.match(/^rounds=(\d+)$/i)
  if (!m) return null
  const n = Number.parseInt(m[1]!, 10)
  if (!Number.isFinite(n)) return null
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, n))
}

function isPairToken(token: string): token is CritiquePairId {
  return token === 'writer' || token === 'coder'
}

/** Parse `/critique [writer|coder] [rounds=N] <task>`. */
export function parseCritiqueArgs(raw: string): ParsedCritiqueArgs {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  let pair: CritiquePairId = DEFAULT_PAIR
  let rounds = DEFAULT_ROUNDS
  const taskParts: string[] = []

  for (const token of tokens) {
    if (isPairToken(token.toLowerCase())) {
      pair = token.toLowerCase()
      continue
    }
    const r = parseRounds(token)
    if (r !== null) {
      rounds = r
      continue
    }
    taskParts.push(token)
  }

  return {
    pair,
    rounds,
    task: taskParts.join(' ').trim(),
  }
}

export function formatCritiqueUsage(): string {
  const pairs = Object.values(CRITIQUE_PAIRS)
    .map(p => `  ${p.id} — ${p.label}`)
    .join('\n')
  return [
    'Multi-agent critique — paired agents argue, revise, and expose failure modes.',
    '',
    'Usage: /critique [writer|coder] [rounds=N] <task>',
    '',
    'Pairs:',
    pairs,
    '',
    `Defaults: ${DEFAULT_PAIR} · ${DEFAULT_ROUNDS} rounds (max ${MAX_ROUNDS})`,
    '',
    'Examples:',
    '  /critique writer README intro for this repo',
    '  /critique coder rounds=3 add retry logic to the API client',
    '  /critique refactor auth middleware for clarity',
  ].join('\n')
}
