import { createContext, useContext } from 'react'
import type { BlinkTranscriptContextValue } from '../../services/blink/dx/blinkTranscriptCollapse.js'

export type { BlinkTranscriptContextValue } from '../../services/blink/dx/blinkTranscriptCollapse.js'

const EMPTY = new Set<string>()

export const BlinkTranscriptContext = createContext<BlinkTranscriptContextValue>({
  hiddenToolUseIds: EMPTY,
  visibleWritePaths: EMPTY,
  hiddenDuplicateAssistantTextUuids: EMPTY,
})

export function useBlinkTranscript(): BlinkTranscriptContextValue {
  return useContext(BlinkTranscriptContext)
}
