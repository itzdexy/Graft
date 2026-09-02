import type { LocalCommandCall } from '../../types/command.js'
import { aiderCommitMessageFromSummary } from '../../services/tovyr/ecosystem/adapters/aider.js'
import { commitTovyrChanges } from '../../services/tovyr/git/checkpoint.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalCommandCall = async (args) => {
  const summary = aiderCommitMessageFromSummary(args.trim() || 'apply AI edits')
  const result = await commitTovyrChanges(getCwd(), summary)
  return { type: 'text', value: result.message }
}
