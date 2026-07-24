import { getCwd } from '../../../utils/cwd.js'
import { logForDebugging } from '../../../utils/debug.js'
import { isBlinkRuntime } from '../../../utils/blinkRuntime.js'
import { createEditCheckpoint } from '../git/checkpoint.js'

let checkpointedMessageId: string | undefined

/** Git checkpoint before the first file edit in an assistant turn (Blink only). */
export async function maybeCheckpointBeforeEdit(
  assistantMessageId?: string,
): Promise<void> {
  if (!isBlinkRuntime()) return
  if (assistantMessageId && checkpointedMessageId === assistantMessageId) return
  if (assistantMessageId) checkpointedMessageId = assistantMessageId
  try {
    await createEditCheckpoint(getCwd())
  } catch (error) {
    logForDebugging(
      `[blink] Edit checkpoint skipped: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
