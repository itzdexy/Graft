import { BUILD_INTENT_RE } from './buildIntent.js'
import { isSuperthinkEnabled } from '../superthink/state.js'
import { getActiveSuperthinkGoal } from '../superthink/sessionStore.js'
import { isVagueSuperthinkGoal } from '../superthink/goalResolve.js'
export type BlinkIntentKind =
  | 'build'
  | 'fix'
  | 'deploy'
  | 'research'
  | 'github'
  | 'benchmark'
  | 'explain'
  | 'optimize'
  | 'general'

export type BlinkIntent = {
  kind: BlinkIntentKind
  /** Suggested slash command or CLI invocation for the REPL to run or recommend. */
  suggestedCommand: string
  /** Whether to prefer the autonomous `/agent` loop over a single-shot command. */
  preferAgentLoop: boolean
  /** Short hint for the model about which specialist roles to emphasize. */
  specialistHints: string[]
}

const DEPLOY_RE =
  /\b(deploy|staging|production|prod|kubernetes|k8s|terraform|docker\s+compose|ci\/cd|pipeline)\b/i
const FIX_RE =
  /\b(fix|failing tests?|broken|debug|regression|failing ci|red build)\b/i
const BUILD_RE = BUILD_INTENT_RE
const RESEARCH_RE =
  /\b(research|best .+ for|evaluate|pros and cons|which .+ should)\b/i
const COMPARE_RE = /\b(compare models?|blind compare|model compare|side by side)\b/i
const DEEP_RESEARCH_RE =
  /\b(deep research|thorough research|comprehensive research|investigate .+ in depth)\b/i
const GITHUB_RE = /\b(github issue|#\d+|pull request|pr #|open issue)\b/i
const BENCHMARK_RE =
  /\b(benchmark|profile|latency|throughput|fps|performance test|load test)\b/i
const EXPLAIN_RE =
  /\b(explain (this )?codebase|how does .+ work|architecture overview|walk me through)\b/i
const OPTIMIZE_RE =
  /\b(optimize|optimise|speed up|reduce memory|improve fps|lower latency)\b/i

/**
 * Classify a natural-language goal (e.g. `blink build a rust web server`) into
 * a suggested command and agent strategy. Heuristic only — the LLM refines in-session.
 */
const GITHUB_ISSUE_URL_RE =
  /https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+/i

export function resolveBlinkIntent(input: string): BlinkIntent {
  const text = input.trim()
  const lower = text.toLowerCase()

  if (GITHUB_ISSUE_URL_RE.test(text)) {
    return {
      kind: 'github',
      suggestedCommand: `/resolve-issue ${text.match(GITHUB_ISSUE_URL_RE)![0]}`,
      preferAgentLoop: true,
      specialistHints: ['debugger', 'coder', 'reviewer'],
    }
  }

  if (GITHUB_RE.test(lower)) {
    return {
      kind: 'github',
      suggestedCommand: `/agent start ${text}`,
      preferAgentLoop: true,
      specialistHints: ['planner', 'coder', 'reviewer'],
    }
  }

  if (DEPLOY_RE.test(lower)) {
    return {
      kind: 'deploy',
      suggestedCommand: `/agent start ${text}`,
      preferAgentLoop: true,
      specialistHints: ['devops', 'reviewer', 'benchmark'],
    }
  }

  if (FIX_RE.test(lower)) {
    return {
      kind: 'fix',
      suggestedCommand: `/agent start --autofix ${text}`,
      preferAgentLoop: true,
      specialistHints: ['debugger', 'coder', 'reviewer'],
    }
  }

  if (OPTIMIZE_RE.test(lower)) {
    return {
      kind: 'optimize',
      suggestedCommand: `/agent start ${text}`,
      preferAgentLoop: true,
      specialistHints: ['benchmark', 'coder', 'reviewer'],
    }
  }

  if (BENCHMARK_RE.test(lower)) {
    return {
      kind: 'benchmark',
      suggestedCommand: `/agent start ${text}`,
      preferAgentLoop: true,
      specialistHints: ['benchmark', 'devops', 'research'],
    }
  }

  if (EXPLAIN_RE.test(lower)) {
    return {
      kind: 'explain',
      suggestedCommand: `/analyze`,
      preferAgentLoop: false,
      specialistHints: ['planner', 'research', 'memory'],
    }
  }

  if (COMPARE_RE.test(lower)) {
    return {
      kind: 'research',
      suggestedCommand: `/compare ${text}`,
      preferAgentLoop: false,
      specialistHints: ['research', 'benchmark'],
    }
  }

  if (DEEP_RESEARCH_RE.test(lower)) {
    return {
      kind: 'research',
      suggestedCommand: `/deep-research ${text.replace(/^deep research\s+/i, '')}`,
      preferAgentLoop: false,
      specialistHints: ['research', 'browser'],
    }
  }

  if (RESEARCH_RE.test(lower)) {
    return {
      kind: 'research',
      suggestedCommand: `/browser research ${text.replace(/^research\s+/i, '')}`,
      preferAgentLoop: false,
      specialistHints: ['research', 'browser'],
    }
  }

  if (BUILD_RE.test(lower)) {
    const goal = text.replace(
      /^(build|implement|create|scaffold|code me|code a|code an|make me|write a|write an|build a|build an|create a|create an)\s+/i,
      '',
    )
    return {
      kind: 'build',
      suggestedCommand: `/agent start --autofix ${goal || text}`,
      preferAgentLoop: true,
      specialistHints: ['planner', 'coder', 'reviewer', 'debugger'],
    }
  }

  return {
    kind: 'general',
    suggestedCommand: text,
    preferAgentLoop: false,
    specialistHints: [],
  }
}

export function routeBlinkCliPrompt(prompt: string, cwd?: string): string {
  const trimmed = prompt.trim()
  if (!trimmed || trimmed.startsWith('/')) return prompt
  // Single-token prompts stay as normal chat (e.g. `blink hello`).
  if (!/\s/.test(trimmed)) return prompt
  if (cwd && isSuperthinkEnabled(cwd)) {
    const active = getActiveSuperthinkGoal(cwd)
    if (active && isVagueSuperthinkGoal(trimmed)) {
      return '/superthink go'
    }
    return `/superthink ${trimmed}`
  }
  return resolveBlinkIntent(trimmed).suggestedCommand
}

export function formatIntentHint(input: string): string {
  const intent = resolveBlinkIntent(input)
  const agentNote = intent.preferAgentLoop
    ? 'Prefer the autonomous agent loop with verify/autofix.'
    : 'A focused single command may be enough.'
  return [
    `Detected intent: **${intent.kind}**`,
    `Suggested: \`${intent.suggestedCommand}\``,
    `Specialists: ${intent.specialistHints.join(', ')}.`,
    agentNote,
  ].join('\n')
}
