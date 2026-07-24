import type { LocalCommandCall } from '../../types/command.js'
import { aiderCommitMessageFromSummary } from '../../services/blink/ecosystem/adapters/aider.js'
import { commitBlinkChanges } from '../../services/blink/git/checkpoint.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalCommandCall = async (args) => {
  const summary = aiderCommitMessageFromSummary(args.trim() || 'apply AI edits')
  const result = await commitBlinkChanges(getCwd(), summary)
  return { type: 'text', value: result.message }
}
