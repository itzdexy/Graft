import { createContext, useContext } from 'react'
import type { TovyrTranscriptContextValue } from '../../services/tovyr/dx/tovyrTranscriptCollapse.js'

export type { TovyrTranscriptContextValue } from '../../services/tovyr/dx/tovyrTranscriptCollapse.js'

const EMPTY = new Set<string>()

export const TovyrTranscriptContext = createContext<TovyrTranscriptContextValue>({
  hiddenToolUseIds: EMPTY,
  visibleWritePaths: EMPTY,
  hiddenDuplicateAssistantTextUuids: EMPTY,
})

export function useTovyrTranscript(): TovyrTranscriptContextValue {
  return useContext(TovyrTranscriptContext)
}
