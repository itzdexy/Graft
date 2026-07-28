import { getCwd } from '../../../utils/cwd.js'
import { logForDebugging } from '../../../utils/debug.js'
import { isTovyrRuntime } from '../../../utils/tovyrRuntime.js'
import { createEditCheckpoint } from '../git/checkpoint.js'

let checkpointedMessageId: string | undefined

/** Git checkpoint before the first file edit in an assistant turn (Tovyr only). */
export async function maybeCheckpointBeforeEdit(
  assistantMessageId?: string,
): Promise<void> {
  if (!isTovyrRuntime()) return
  if (assistantMessageId && checkpointedMessageId === assistantMessageId) return
  if (assistantMessageId) checkpointedMessageId = assistantMessageId
  try {
    await createEditCheckpoint(getCwd())
  } catch (error) {
    logForDebugging(
      `[tovyr] Edit checkpoint skipped: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
