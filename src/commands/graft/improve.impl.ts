import type { LocalJSXCommandCall } from '../../types/command.js'
import { getGptEngineerImprovePreprompt } from '../../services/graft/ecosystem/adapters/gpt-engineer.js'

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const goal = args.trim()
  onDone(undefined, {
    shouldQuery: true,
    metaMessages: [getGptEngineerImprovePreprompt(goal || undefined)],
  })
  return null
}
