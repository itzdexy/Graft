import { getCwd } from '../../../utils/cwd.js'
import { logForDebugging } from '../../../utils/debug.js'
import { isGraftRuntime } from '../../../utils/graftRuntime.js'
import { createEditCheckpoint } from '../git/checkpoint.js'

let checkpointedMessageId: string | undefined

/** Git checkpoint before the first file edit in an assistant turn (Graft only). */
export async function maybeCheckpointBeforeEdit(
  assistantMessageId?: string,
): Promise<void> {
  if (!isGraftRuntime()) return
  if (assistantMessageId && checkpointedMessageId === assistantMessageId) return
  if (assistantMessageId) checkpointedMessageId = assistantMessageId
  try {
    await createEditCheckpoint(getCwd())
  } catch (error) {
    logForDebugging(
      `[graft] Edit checkpoint skipped: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
