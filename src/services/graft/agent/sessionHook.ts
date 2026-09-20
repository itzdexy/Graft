/**
 * Auto-advance persisted /agent sessions when the model marks a step complete.
 * Enforces loop guard limits (max turns, tool failures, empty output).
 */

import type { Message } from '../../../types/message.js'
import { getAssistantMessageText } from '../../../utils/messages.js'
import { AgentManager } from './AgentManager.js'
import {
  applyLoopStop,
  recordAgentTurn,
} from './loopGuard.js'
import { loadAgentSession, saveAgentSession } from './persistence.js'
import { appendReflection } from './ReflectionEngine.js'

const STEP_COMPLETE_MARKERS = [
  '### step complete',
  '## step complete',
  'step complete:',
]

function lastAssistantText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.type !== 'assistant') continue
    try {
      const text = getAssistantMessageText(m) ?? ''
      if (text.trim()) return text
    } catch {
      // fall through
    }
  }
  return ''
}

function indicatesStepComplete(text: string): boolean {
  const lower = text.toLowerCase()
  return STEP_COMPLETE_MARKERS.some(marker => lower.includes(marker))
}

/** Call after each REPL turn when a Graft agent session may be active. */
export function maybeAdvanceAgentSession(cwd: string, messages: Message[]): void {
  let session = loadAgentSession(cwd)
  if (!session || session.phase === 'done' || session.phase === 'failed') {
    return
  }

  const text = lastAssistantText(messages)
  const turnCheck = recordAgentTurn(session, text)
  if (!turnCheck.allowed) {
    session = applyLoopStop(session, turnCheck)
    saveAgentSession(session)
    return
  }

  if (!indicatesStepComplete(text)) {
    saveAgentSession(session)
    return
  }

  const manager = new AgentManager(cwd)
  session = manager.completeCurrentStep(session)
  session = appendReflection(
    session,
    `Step completed after turn ${session.loop?.turnCount ?? 0}.`,
  )

  if (session.phase !== 'done') {
    const advanced = manager.advancePhase(session)
    const step = advanced.steps[advanced.currentStepIndex]
    if (step && step.status === 'pending') {
      step.status = 'in_progress'
      saveAgentSession(advanced)
      return
    }
    saveAgentSession(advanced)
    return
  }

  saveAgentSession(session)
}
