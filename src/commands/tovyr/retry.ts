import type { Command, LocalCommandResult } from '../../commands.js'
import type { ToolUseContext } from '../../Tool.js'
import {
  canRewindToUserMessage,
  findLastSelectableUserMessage,
} from '../../services/tovyr/hermes/conversationRewind.js'

const retry: Command = {
  type: 'local',
  name: 'retry',
  description: 'Rewind to your last prompt and restore it for editing (Hermes-style)',
  supportsNonInteractive: false,
  load: () => import('./retry.impl.js'),
}

export default retry

export async function retryLastTurn(
  context: ToolUseContext,
): Promise<LocalCommandResult> {
  const last = findLastSelectableUserMessage(context.messages)
  if (!last) {
    return { type: 'text', value: 'Nothing to retry — no user prompts in this session.' }
  }
  if (!canRewindToUserMessage(context.messages, last)) {
    return {
      type: 'text',
      value:
        'Cannot retry yet — wait for the current response to finish, or use /rewind to pick an earlier message.',
    }
  }
  if (!context.restoreUserMessage) {
    return {
      type: 'text',
      value: 'Retry is only available in the interactive Tovyr REPL.',
    }
  }
  context.restoreUserMessage(last, { restoreInput: true })
  return { type: 'skip' }
}
