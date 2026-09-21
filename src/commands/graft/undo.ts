import type { Command, LocalCommandResult } from '../../commands.js'
import type { ToolUseContext } from '../../Tool.js'
import {
  canRewindToUserMessage,
  findLastSelectableUserMessage,
} from '../../services/graft/hermes/conversationRewind.js'
import { undoLastGraftCommit } from '../../services/graft/git/checkpoint.js'
import { getCwd } from '../../utils/cwd.js'

const undo: Command = {
  type: 'local',
  name: 'undo',
  description: 'Undo the last conversation turn or preview a Git revert',
  argumentHint: '[git [apply <commit>]]',
  supportsNonInteractive: false,
  load: () => import('./undo.impl.js'),
}

export default undo

export async function undoLastTurn(
  context: ToolUseContext,
  args?: string,
): Promise<LocalCommandResult> {
  const sub = args?.trim().toLowerCase()
  if (sub === 'git' || sub === '--git' || sub?.startsWith('git ') || sub?.startsWith('--git ')) {
    const parts = sub.replace(/^--git/, 'git').split(/\s+/)
    if (parts.length !== 1 && !(parts.length === 3 && parts[1] === 'apply' && /^[a-f0-9]{40,64}$/.test(parts[2]!))) {
      return { type: 'text', value: 'Use /undo git to preview, then /undo git apply <commit> with the displayed commit ID.' }
    }
    const result = await undoLastGraftCommit(getCwd(), parts[2])
    return {
      type: 'text',
      value: result.ok ? result.message : `Git undo failed: ${result.message}`,
    }
  }

  if (sub) return { type: 'text', value: 'Use /undo for the last conversation turn, or /undo git for a Git preview.' }

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
      value: 'Undo is only available in the interactive Graft REPL.',
    }
  }
  context.restoreUserMessage(last, { restoreInput: false })
  return {
    type: 'text',
    value: 'Undid the last turn. Conversation rewound to before your previous prompt.',
  }
}
