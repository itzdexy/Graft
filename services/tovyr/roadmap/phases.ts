/**
 * Public roadmap pointer — no internal phase timeline in open source builds.
 */

export type RoadmapPhaseStatus = 'done' | 'partial' | 'planned'

export type RoadmapPhase = {
  id: number
  name: string
  status: RoadmapPhaseStatus
  command?: string
  module: string
}

export const ROADMAP_PHASES: RoadmapPhase[] = []

export function formatRoadmapStatus(): string {
  return [
    '# Tovyr roadmap',
    '',
    'Track features, bugs, and requests on GitHub:',
    'https://github.com/itsdexy/Tovyr/issues',
    '',
    'In-app help: `/guide` · User docs: `docs/GUIDE.md`',
  ].join('\n')
}

export function countPhasesByStatus(): Record<RoadmapPhaseStatus, number> {
  return { done: 0, partial: 0, planned: 0 }
}
