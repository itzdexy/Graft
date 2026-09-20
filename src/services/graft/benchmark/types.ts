export type BenchCategory =
  | 'install'
  | 'safety'
  | 'context'
  | 'permissions'
  | 'tools'
  | 'agent'
  | 'live'

export type BenchCaseDef = {
  id: string
  name: string
  category: BenchCategory
  description: string
  weight: number
  /** offline = no API; live = needs provider key */
  mode: 'offline' | 'live'
}

export type BenchCaseResult = {
  id: string
  name: string
  category: BenchCategory
  mode: 'offline' | 'live'
  passed: boolean
  score: number
  weight: number
  durationMs: number
  detail?: string
  error?: string
}

export type BenchRunReport = {
  version: 1
  suite: string
  startedAt: string
  finishedAt: string
  durationMs: number
  cwd: string
  provider?: string
  model?: string
  graftVersion?: string
  results: BenchCaseResult[]
  summary: BenchSummary
}

export type BenchSummary = {
  total: number
  passed: number
  failed: number
  skipped: number
  score: number
  maxScore: number
  scorePercent: number
  byCategory: Record<string, { passed: number; total: number; score: number }>
  liveIncluded: boolean
}
