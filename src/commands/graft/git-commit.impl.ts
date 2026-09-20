import type { LocalCommandCall } from '../../types/command.js'
import { aiderCommitMessageFromSummary } from '../../services/graft/ecosystem/adapters/aider.js'
import { commitGraftChanges } from '../../services/graft/git/checkpoint.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalCommandCall = async (args) => {
  const summary = aiderCommitMessageFromSummary(args.trim() || 'apply AI edits')
  const result = await commitGraftChanges(getCwd(), summary)
  return { type: 'text', value: result.message }
}
