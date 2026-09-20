import type { BenchCaseDef } from './types.js'

export const BENCH_SUITES = {
  smoke: 'Quick offline checks (~5s, no API)',
  offline: 'Full offline harness (safety, context, permissions)',
  live: 'Live API probes (needs configured provider)',
  full: 'Offline + live when API key present',
} as const

export type BenchSuiteName = keyof typeof BENCH_SUITES

export const OFFLINE_CASES: BenchCaseDef[] = [
  {
    id: 'doctor-json',
    name: 'Doctor JSON report',
    category: 'install',
    description: 'graft doctor --json exits 0',
    weight: 2,
    mode: 'offline',
  },
  {
    id: 'config-json',
    name: 'Config JSON',
    category: 'install',
    description: 'graft config --json parses',
    weight: 1,
    mode: 'offline',
  },
  {
    id: 'project-scan',
    name: 'Project scanner',
    category: 'context',
    description: 'Detects package.json and scripts in repo root',
    weight: 2,
    mode: 'offline',
  },
  {
    id: 'secret-paths',
    name: 'Secret path detection',
    category: 'safety',
    description: 'Flags .env and private keys',
    weight: 2,
    mode: 'offline',
  },
  {
    id: 'destructive-shell',
    name: 'Destructive shell patterns',
    category: 'safety',
    description: 'Blocks rm -rf, force push, curl|bash',
    weight: 2,
    mode: 'offline',
  },
  {
    id: 'tool-gate-plan',
    name: 'Plan mode blocks edits',
    category: 'permissions',
    description: 'Edit tool requires /code in plan mode',
    weight: 2,
    mode: 'offline',
  },
  {
    id: 'safe-mode-shell',
    name: 'Safe mode blocks shell',
    category: 'permissions',
    description: '/safe denies Bash',
    weight: 2,
    mode: 'offline',
  },
  {
    id: 'main-loop-limits',
    name: 'Turn limit resolver',
    category: 'agent',
    description: 'GRAFT_MAX_TURNS parsing',
    weight: 1,
    mode: 'offline',
  },
  {
    id: 'patch-preview',
    name: 'Edit diff preview',
    category: 'tools',
    description: 'Unified diff preview for edits',
    weight: 1,
    mode: 'offline',
  },
  {
    id: 'cli-help',
    name: 'CLI help',
    category: 'install',
    description: 'graft --help includes bench command',
    weight: 1,
    mode: 'offline',
  },
]

export const LIVE_CASES: BenchCaseDef[] = [
  {
    id: 'live-ping',
    name: 'Model ping',
    category: 'live',
    description: 'Reply with exact token GRAFT_BENCH_OK',
    weight: 3,
    mode: 'live',
  },
  {
    id: 'live-math',
    name: 'Reasoning',
    category: 'live',
    description: '17 * 23 = 391 in response',
    weight: 2,
    mode: 'live',
  },
  {
    id: 'live-brief',
    name: 'Concise reply',
    category: 'live',
    description: 'Short answer under 200 chars for hello',
    weight: 1,
    mode: 'live',
  },
]

export function casesForSuite(
  suite: BenchSuiteName,
  includeLive: boolean,
): BenchCaseDef[] {
  switch (suite) {
    case 'smoke':
      return OFFLINE_CASES.filter(c =>
        ['doctor-json', 'project-scan', 'destructive-shell', 'cli-help'].includes(
          c.id,
        ),
      )
    case 'offline':
      return [...OFFLINE_CASES]
    case 'live':
      return [...LIVE_CASES]
    case 'full':
      return includeLive
        ? [...OFFLINE_CASES, ...LIVE_CASES]
        : [...OFFLINE_CASES]
    default:
      return [...OFFLINE_CASES]
  }
}
