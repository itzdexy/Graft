import type {
  ParsedSuperthinkArgs,
  SuperthinkAnswer,
  SuperthinkPlan,
  SuperthinkQuestion,
} from './types.js'

/** Parse `/superthink` arguments into a command + payload. */
export function parseSuperthinkArgs(args: string): ParsedSuperthinkArgs {
  const trimmed = args.trim()
  if (!trimmed || trimmed === 'help' || trimmed === '?') {
    return { command: 'help', goal: '' }
  }
  const [first, ...tail] = trimmed.split(/\s+/)
  const head = first!.toLowerCase()
  switch (head) {
    case 'on':
    case 'enable':
      return { command: 'on', goal: '' }
    case 'off':
    case 'disable':
      return { command: 'off', goal: '' }
    case 'status':
      return { command: 'status', goal: '' }
    case 'result':
      return { command: 'result', goal: tail.join(' ').trim() }
    case 'continue':
      return { command: 'continue', goal: tail.join(' ').trim() }
    case 'go':
    case 'build':
    case 'implement':
    case 'ship':
      return { command: 'go', goal: tail.join(' ').trim() }
    default:
      // Anything else is treated as the goal to think hard about.
      return { command: 'run', goal: trimmed }
  }
}

const CORE_QUESTIONS: SuperthinkQuestion[] = [
  {
    id: 'outcome',
    prompt: 'In one or two sentences, what does success look like?',
    type: 'text',
    placeholder: 'When this is done, a user can…',
    required: true,
  },
  {
    id: 'audience',
    prompt: 'Who is this for / who will use it?',
    type: 'text',
    placeholder: 'e.g. internal team, end users, just me',
  },
  {
    id: 'constraints',
    prompt: 'Any hard constraints or must-haves?',
    type: 'text',
    placeholder: 'e.g. must run offline, no new dependencies, deadline',
  },
  {
    id: 'nonGoals',
    prompt: 'What is explicitly OUT of scope (non-goals)?',
    type: 'text',
    placeholder: 'Things we should NOT do',
  },
]

/** Heuristically detect the kind of project from the goal text. */
export function detectProjectKind(goal: string): string {
  const g = goal.toLowerCase()
  if (/\b(web\s?site|webpage|landing|frontend|react|next|vue|svelte|html|css)\b/.test(g))
    return 'web'
  if (/\b(api|endpoint|server|backend|rest|graphql|service)\b/.test(g)) return 'api'
  if (/\b(cli|command[- ]line|terminal|script)\b/.test(g)) return 'cli'
  if (/\b(library|package|sdk|module)\b/.test(g)) return 'library'
  if (/\b(data|etl|pipeline|ml|model|analysis|dataset)\b/.test(g)) return 'data'
  return 'general'
}

/**
 * Build a strong default set of clarifying questions tailored to the goal. The
 * model can extend or replace these, but this lets superthink "do the best it
 * can" deterministically even before any model call.
 */
export function buildDefaultQuestions(goal: string): SuperthinkQuestion[] {
  const kind = detectProjectKind(goal)
  const questions: SuperthinkQuestion[] = [...CORE_QUESTIONS]

  if (kind === 'web') {
    questions.push({
      id: 'stack',
      prompt: 'Preferred stack for the web build?',
      type: 'choice',
      options: ['Plain HTML/CSS/JS', 'React', 'Vue', 'Svelte', 'No preference'],
    })
  } else if (kind === 'api') {
    questions.push({
      id: 'stack',
      prompt: 'Preferred backend stack?',
      type: 'choice',
      options: ['Node/Express', 'Node/Fastify', 'Python/FastAPI', 'No preference'],
    })
  } else if (kind === 'cli' || kind === 'library' || kind === 'data') {
    questions.push({
      id: 'language',
      prompt: 'Preferred language?',
      type: 'choice',
      options: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'No preference'],
    })
  }

  questions.push(
    {
      id: 'tests',
      prompt: 'Should this be built test-first (TDD)?',
      type: 'boolean',
      help: 'Superthinker defaults to red/green TDD like its design methodology.',
    },
    {
      id: 'risks',
      prompt: 'Anything tricky, risky, or easy to get wrong here?',
      type: 'text',
      placeholder: 'Edge cases, integrations, performance concerns…',
    },
  )

  return questions
}

function coerceString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(v => String(v)).join(', ').trim()
  if (value == null) return ''
  return String(value).trim()
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  const s = coerceString(value).toLowerCase()
  return s === 'true' || s === 'on' || s === 'yes' || s === '1'
}

function coerceList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(v => coerceString(v)).filter(Boolean)
  }
  const s = coerceString(value)
  if (!s) return []
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
}

function isEmptyValue(v: SuperthinkAnswer['value']): boolean {
  if (typeof v === 'boolean') return false // a boolean answer is always "answered"
  if (Array.isArray(v)) return v.length === 0
  return v.trim().length === 0
}

/**
 * Map a raw submitted form body to validated answers. Returns the normalized
 * answers plus the ids of any REQUIRED questions left blank, so the server can
 * re-prompt instead of proceeding with a half-spec.
 */
export function normalizeSubmittedAnswers(
  questions: SuperthinkQuestion[],
  raw: Record<string, unknown>,
): { answers: SuperthinkAnswer[]; missingRequired: string[] } {
  const answers: SuperthinkAnswer[] = []
  const missingRequired: string[] = []

  for (const q of questions) {
    const rawValue = raw[q.id]
    let value: SuperthinkAnswer['value']
    switch (q.type) {
      case 'boolean':
        value = coerceBoolean(rawValue)
        break
      case 'multichoice':
        value = coerceList(rawValue)
        break
      default:
        value = coerceString(rawValue)
        break
    }
    if (q.required && isEmptyValue(value)) {
      missingRequired.push(q.id)
    }
    answers.push({ id: q.id, value })
  }

  return { answers, missingRequired }
}

function formatAnswerValue(value: SuperthinkAnswer['value']): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)'
  return value.trim() || '(blank)'
}

/** Render the Q&A as a readable block for the model prompt. */
export function answersToContext(
  questions: SuperthinkQuestion[],
  answers: SuperthinkAnswer[],
): string {
  const byId = new Map(answers.map(a => [a.id, a.value]))
  return questions
    .map(q => `- ${q.prompt}\n  → ${formatAnswerValue(byId.get(q.id) ?? '')}`)
    .join('\n')
}

/**
 * Synthesize an initial plan deterministically from the goal + answers. This is
 * the design shown for sign-off; inspired by obra/superpowers writing-plans.
 */
export function synthesizePlan(
  goal: string,
  questions: SuperthinkQuestion[],
  answers: SuperthinkAnswer[],
): SuperthinkPlan {
  const byId = new Map(answers.map(a => [a.id, a.value]))
  const get = (id: string): SuperthinkAnswer['value'] | undefined => byId.get(id)

  const outcome = get('outcome')
  const summary =
    typeof outcome === 'string' && outcome.trim()
      ? `Goal: ${goal.trim()} — success means: ${outcome.trim()}`
      : `Goal: ${goal.trim()}`

  const decisions: string[] = []
  for (const q of questions) {
    if (q.id === 'outcome') continue
    const v = get(q.id)
    if (v === undefined) continue
    const formatted = formatAnswerValue(v)
    if (formatted === '(blank)' || formatted === '(none)') continue
    decisions.push(`${q.prompt} → ${formatted}`)
  }

  const wantsTdd = get('tests') === true
  const kind = detectProjectKind(goal)
  const stackAnswer = get('stack') ?? get('language')
  const stack =
    typeof stackAnswer === 'string' && stackAnswer.trim() && stackAnswer !== 'No preference'
      ? stackAnswer.trim()
      : kind === 'web'
        ? 'Plain HTML/CSS/JS'
        : kind === 'api'
          ? 'Node/TypeScript'
          : 'match project conventions'

  const steps: string[] = []

  if (kind === 'web') {
    steps.push(
      `Create project skeleton: \`index.html\`, \`styles.css\`, \`script.js\` (or stack: ${stack}).`,
      'Build layout shell: header, main content area, footer — semantic HTML, mobile-first CSS.',
      'Add portfolio sections: hero, about, projects grid, contact — placeholder content OK initially.',
      'Wire interactivity (nav, smooth scroll, project cards) in `script.js` if needed.',
      'Polish: typography, spacing, responsive breakpoints, favicon/meta tags.',
    )
  } else if (kind === 'api') {
    steps.push(
      `Scaffold API entry (\`src/index.ts\` or equivalent) with ${stack}.`,
      'Define routes/handlers for core resources from the spec.',
      'Add validation and error responses.',
      'Document how to run locally (`README` snippet).',
    )
  } else if (kind === 'cli') {
    steps.push(
      `Scaffold CLI entry (\`src/cli.ts\` or \`bin/\`) with ${stack}.`,
      'Parse args and implement the primary command path.',
      'Add `--help` and exit codes.',
    )
  } else {
    steps.push(
      'Create minimal project structure for the agreed stack.',
      'Implement the core happy path end-to-end.',
      'Add error handling and a short README on how to run.',
    )
  }

  if (wantsTdd) {
    steps.splice(
      1,
      0,
      'RED: write a failing test for the first behavior; GREEN: minimal code to pass; repeat per feature.',
    )
  } else {
    steps.push('Manual verify: open/run the result and check each success criterion.')
  }

  steps.push(
    'Run `/superthink result <output-dir>` to serve a localhost preview when UI output exists.',
    'Summarize: files changed, how to run, what was verified.',
  )

  return { summary, decisions, steps }
}
