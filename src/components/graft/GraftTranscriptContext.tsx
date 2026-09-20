import { createContext, useContext } from 'react'
import type { GraftTranscriptContextValue } from '../../services/graft/dx/graftTranscriptCollapse.js'

export type { GraftTranscriptContextValue } from '../../services/graft/dx/graftTranscriptCollapse.js'

const EMPTY = new Set<string>()

export const GraftTranscriptContext = createContext<GraftTranscriptContextValue>({
  hiddenToolUseIds: EMPTY,
  visibleWritePaths: EMPTY,
  hiddenDuplicateAssistantTextUuids: EMPTY,
})

export function useGraftTranscript(): GraftTranscriptContextValue {
  return useContext(GraftTranscriptContext)
}
