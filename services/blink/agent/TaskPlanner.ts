import { randomUUID } from 'crypto'
import type { AgentStep, SpecialistRole } from './types.js'

export type PlanOptions = {
  includeResearch?: boolean
  includeReview?: boolean
  includeBrowser?: boolean
}

const DEFAULT_STEPS: Array<{
  title: string
  description: string
  specialist: SpecialistRole
}> = [
  {
    title: 'Observe repository context',
    description:
      'Read relevant files, grep for symbols, understand existing patterns and constraints.',
    specialist: 'planner',
  },
  {
    title: 'Think and refine approach',
    description:
      'List risks, dependencies, and the smallest viable change set. Note what not to touch.',
    specialist: 'planner',
  },
  {
    title: 'Produce execution plan',
    description:
      'Break work into ordered subtasks with file paths. Get user alignment if requirements are ambiguous.',
    specialist: 'planner',
  },
  {
    title: 'Implement changes',
    description:
      'Edit/create files using project conventions. Prefer small diffs. Use Agent subagents for large isolated chunks.',
    specialist: 'coder',
  },
  {
    title: 'Verify (tests, lint, build)',
    description:
      'Run tests, lint, and build commands appropriate for this repo. Fix failures before proceeding.',
    specialist: 'debugger',
  },
  {
    title: 'Review quality',
    description:
      'Self-review for bugs, security, edge cases, and naming. Cite specific files/lines.',
    specialist: 'reviewer',
  },
  {
    title: 'Reflect and document',
    description:
      'Summarize what changed, what was learned, and update project memory if durable facts emerged.',
    specialist: 'coordinator',
  },
]

function makeStep(
  title: string,
  description: string,
  specialist: SpecialistRole,
): AgentStep {
  return {
    id: randomUUID(),
    title,
    description,
    status: 'pending',
    specialist,
    attempts: 0,
  }
}

/** Decompose a user goal into an ordered step list (heuristic; LLM refines in execute phase). */
export function planTask(goalText: string, options: PlanOptions = {}): AgentStep[] {
  const steps = DEFAULT_STEPS.map(s => makeStep(s.title, s.description, s.specialist))
  const lower = goalText.toLowerCase()

  if (options.includeResearch !== false && needsResearch(lower)) {
    steps.splice(2, 0, makeStep(
      'Research external docs and patterns',
      'Use WebSearch, WebFetch, or /browser to gather API docs, library usage, and examples.',
      'research',
    ))
  }

  if (options.includeBrowser !== false && needsBrowser(lower)) {
    steps.splice(2, 0, makeStep(
      'Browser verification',
      'Open relevant URLs, read documentation pages, extract facts needed for implementation.',
      'browser',
    ))
  }

  if (options.includeReview !== false && isLargeScope(lower)) {
    steps.push(makeStep(
      'Final integration check',
      'Ensure all files work together; run end-to-end smoke test if available.',
      'reviewer',
    ))
  }

  if (needsDevOps(lower)) {
    steps.splice(4, 0, makeStep(
      'Deploy / infra',
      'Build images, apply manifests, run deploy scripts, or open a PR for infra changes. Confirm staging/prod target with user if ambiguous.',
      'devops',
    ))
  }

  if (needsBenchmark(lower)) {
    steps.splice(5, 0, makeStep(
      'Benchmark and measure',
      'Run benchmarks, capture latency/throughput/FPS, compare before/after, estimate cost if LLM-heavy.',
      'benchmark',
    ))
  }

  if (needsMemoryRecall(lower)) {
    steps.splice(1, 0, makeStep(
      'Recall project memory',
      'Search /blink-memory and buddy memory for prior decisions, conventions, and user preferences.',
      'memory',
    ))
  }

  return steps
}

function needsResearch(text: string): boolean {
  return (
    text.includes('integrate') ||
    text.includes('library') ||
    text.includes('api') ||
    text.includes('how to') ||
    text.includes('research')
  )
}

function needsBrowser(text: string): boolean {
  return (
    text.includes('http') ||
    text.includes('documentation') ||
    text.includes('docs.') ||
    text.includes('website')
  )
}

function isLargeScope(text: string): boolean {
  return (
    text.includes('dashboard') ||
    text.includes('refactor') ||
    text.includes('entire') ||
    text.includes('migration') ||
    text.split(' ').length > 12
  )
}

function needsDevOps(text: string): boolean {
  return (
    text.includes('deploy') ||
    text.includes('staging') ||
    text.includes('production') ||
    text.includes('kubernetes') ||
    text.includes('k8s') ||
    text.includes('terraform') ||
    text.includes('docker') ||
    text.includes('ci/cd') ||
    text.includes('pipeline')
  )
}

function needsBenchmark(text: string): boolean {
  return (
    text.includes('benchmark') ||
    text.includes('profile') ||
    text.includes('latency') ||
    text.includes('fps') ||
    text.includes('performance') ||
    text.includes('load test')
  )
}

function needsMemoryRecall(text: string): boolean {
  return (
    text.includes('explain') ||
    text.includes('codebase') ||
    text.includes('remember') ||
    text.includes('convention') ||
    text.includes('architecture')
  )
}

export function formatPlanForPrompt(steps: AgentStep[]): string {
  return steps
    .map((s, i) => `${i + 1}. **${s.title}** (${s.specialist})\n   ${s.description}`)
    .join('\n\n')
}
