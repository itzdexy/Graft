import type { SpecialistRole } from './types.js'

export type SpecialistDefinition = {
  role: SpecialistRole
  label: string
  focus: string
  toolHints: string[]
}

export const SPECIALISTS: Record<SpecialistRole, SpecialistDefinition> = {
  planner: {
    role: 'planner',
    label: 'Planner',
    focus: 'Decompose goals, sequence work, identify risks and dependencies.',
    toolHints: ['Read', 'Grep', 'Glob', 'Agent (explore)'],
  },
  coder: {
    role: 'coder',
    label: 'Coder',
    focus: 'Implement minimal correct changes matching project conventions.',
    toolHints: ['Read', 'Edit', 'Write', 'MultiEdit', 'Bash'],
  },
  reviewer: {
    role: 'reviewer',
    label: 'Reviewer',
    focus: 'Find bugs, security issues, edge cases, and maintainability problems.',
    toolHints: ['Read', 'Grep', 'Agent (code-reviewer if available)'],
  },
  debugger: {
    role: 'debugger',
    label: 'Debugger',
    focus: 'Reproduce failures, isolate root cause, apply targeted fixes.',
    toolHints: ['Bash', 'Read', 'Grep', 'Edit'],
  },
  research: {
    role: 'research',
    label: 'Research',
    focus: 'Gather docs, APIs, and implementation options from the web.',
    toolHints: ['WebSearch', 'WebFetch', 'Agent (general-purpose)'],
  },
  browser: {
    role: 'browser',
    label: 'Browser',
    focus: 'Navigate sites, read pages, verify facts in documentation.',
    toolHints: ['WebFetch', 'WebSearch', 'Playwright/computer-use MCP if configured'],
  },
  devops: {
    role: 'devops',
    label: 'DevOps',
    focus:
      'Deploy, containerize, SSH, CI/CD, cloud infra, and monitor running systems.',
    toolHints: ['Bash', 'Agent (serverless-sme, container-sme)', 'gh', 'kubectl'],
  },
  memory: {
    role: 'memory',
    label: 'Memory',
    focus:
      'Persist durable facts, recall project history, update buddy memory and preferences.',
    toolHints: ['/buddy remember', '/tovyr-memory', 'Read', 'Grep'],
  },
  benchmark: {
    role: 'benchmark',
    label: 'Benchmark',
    focus:
      'Measure latency, throughput, token cost, FPS, and resource usage; compare options.',
    toolHints: ['Bash', 'Read', 'WebSearch', 'Agent (performance-optimizer)'],
  },
  coordinator: {
    role: 'coordinator',
    label: 'Coordinator',
    focus: 'Merge specialist outputs, resolve conflicts, report final status.',
    toolHints: ['Agent', 'TodoWrite', 'TaskCreate'],
  },
}

export function getSpecialistInstructions(role: SpecialistRole): string {
  const s = SPECIALISTS[role]
  const rolePrompts: Partial<Record<SpecialistRole, string>> = {
    coder: 'Coding: read before edit, minimal diffs, run tests after changes.',
    debugger: 'Debugging: reproduce with Bash, fix root cause, cite error output.',
    reviewer: 'Review: cite file:line issues; security and edge cases first.',
    planner: 'Planning: decompose into ordered steps; flag risks before coding.',
  }
  return [
    `### Specialist: ${s.label}`,
    s.focus,
    rolePrompts[role] ?? '',
    `Preferred tools: ${s.toolHints.join(', ')}`,
    role !== 'coordinator'
      ? 'You MAY delegate to the Agent tool with an appropriate subagent_type for isolated work.'
      : 'Delegate to specialists via Agent tool; synthesize their outputs.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatSpecialistRoster(): string {
  return Object.values(SPECIALISTS)
    .map(s => `- **${s.label}** — ${s.focus}`)
    .join('\n')
}
