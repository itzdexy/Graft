import type { Command, LocalCommandResult } from '../../commands.js'
import type { ToolUseContext } from '../../Tool.js'
import {
  canRewindToUserMessage,
  findLastSelectableUserMessage,
} from '../../services/blink/hermes/conversationRewind.js'
import { undoLastBlinkCommit } from '../../services/blink/git/checkpoint.js'
import { getCwd } from '../../utils/cwd.js'

const undo: Command = {
  type: 'local',
  name: 'undo',
  description: 'Undo last turn or revert last blinkcode git commit',
  argumentHint: '[git]',
  supportsNonInteractive: false,
  load: () => import('./undo.impl.js'),
}

export default undo

export async function undoLastTurn(
  context: ToolUseContext,
  args?: string,
): Promise<LocalCommandResult> {
  const sub = args?.trim().toLowerCase()
  if (sub === 'git' || sub === '--git') {
    const result = await undoLastBlinkCommit(getCwd())
    return {
      type: 'text',
      value: result.ok ? result.message : `Git undo failed: ${result.message}`,
    }
  }

  const last = findLastSelectableUserMessage(context.messages)
  if (!last) {
    return { type: 'text', value: 'Nothing to undo — no user prompts in this session.' }
  }
  if (!canRewindToUserMessage(context.messages, last)) {
    return {
      type: 'text',
      value:
        'Cannot undo while a response is still in progress. Cancel or wait for it to finish.',
    }
  }
  if (!context.restoreUserMessage) {
    return {
      type: 'text',
      value: 'Undo is only available in the interactive Blink REPL.',
    }
  }
  context.restoreUserMessage(last, { restoreInput: false })
  return {
    type: 'text',
    value: 'Undid the last turn. Conversation rewound to before your previous prompt.',
  }
}
