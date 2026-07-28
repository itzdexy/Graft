/** Agent pair presets for multi-agent critique sessions. */
export type CritiquePairId = 'writer' | 'coder'

export type CritiqueRole = {
  id: string
  label: string
  persona: string
}

export type CritiquePair = {
  id: CritiquePairId
  label: string
  primary: CritiqueRole
  critic: CritiqueRole
  deliverable: string
}

export const CRITIQUE_PAIRS: Record<CritiquePairId, CritiquePair> = {
  writer: {
    id: 'writer',
    label: 'Writer + Editor',
    primary: {
      id: 'writer',
      label: 'Writer',
      persona:
        'Creative writer focused on clarity, structure, and audience. Produces drafts; accepts critique gracefully but defends intentional choices.',
    },
    critic: {
      id: 'editor',
      label: 'Editor',
      persona:
        'Ruthless but fair editor. Checks logic, tone, completeness, and factual gaps. Names specific fixes, not vague praise.',
    },
    deliverable: 'polished prose (doc, spec, README section, or user-facing copy)',
  },
  coder: {
    id: 'coder',
    label: 'Coder + Reviewer',
    primary: {
      id: 'coder',
      label: 'Coder',
      persona:
        'Implementer who writes minimal, correct code matching project conventions. Explains tradeoffs briefly.',
    },
    critic: {
      id: 'reviewer',
      label: 'Reviewer',
      persona:
        'Senior reviewer hunting bugs, security issues, edge cases, and maintainability problems. Cites file paths and line-level concerns.',
    },
    deliverable: 'code changes or a concrete implementation plan with snippets',
  },
}

export const DEFAULT_PAIR: CritiquePairId = 'writer'
export const DEFAULT_ROUNDS = 2
export const MAX_ROUNDS = 5
export const MIN_ROUNDS = 1
