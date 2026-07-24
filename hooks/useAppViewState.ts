import { useState } from 'react'

export type AppViewState =
  | 'startup'
  | 'ready'
  | 'composing'
  | 'submitting'
  | 'streaming'
  | 'waiting_for_approval'
  | 'cancelled'
  | 'failed'
  | 'completed'

export function useAppViewState(initial: AppViewState = 'startup') {
  const [viewState, setViewState] = useState<AppViewState>(initial)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  return {
    viewState,
    setViewState,
    hasSubmitted,
    markSubmitted: () => setHasSubmitted(true),
    isActive: viewState === 'streaming' || viewState === 'submitting' || viewState === 'waiting_for_approval',
  }
}
