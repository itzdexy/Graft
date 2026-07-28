import { isTovyrRuntime } from '../../../utils/tovyrRuntime.js'
import { summarizeToolInput } from './activityDisplay.js'
import { recordToolActivity } from './activityStore.js'
import { loadAgentSession, saveAgentSession } from '../agent/persistence.js'
import {
  applyLoopStop,
  recordAgentToolCall,
} from '../agent/loopGuard.js'

export function recordToolCompletion(
  cwd: string,
  toolName: string,
  input: Record<string, unknown>,
  ok: boolean,
  durationMs?: number,
): void {
  if (!isTovyrRuntime()) return
  const summary = summarizeToolInput(toolName, input)
  recordToolActivity(cwd, {
    toolName,
    summary,
    ok,
    durationMs,
  })

  const session = loadAgentSession(cwd)
  if (!session || session.phase === 'done' || session.phase === 'failed') {
    return
  }

  const check = recordAgentToolCall(session, { toolName, input, ok })
  if (!check.allowed) {
    saveAgentSession(applyLoopStop(session, check))
    return
  }
  saveAgentSession(session)
}
