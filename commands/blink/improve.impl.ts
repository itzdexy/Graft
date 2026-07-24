import type { LocalJSXCommandCall } from '../../types/command.js'
import { getGptEngineerImprovePreprompt } from '../../services/blink/ecosystem/adapters/gpt-engineer.js'

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const goal = args.trim()
  onDone(undefined, {
    shouldQuery: true,
    metaMessages: [
      {
        type: 'text',
        text: getGptEngineerImprovePreprompt(goal || undefined),
      },
    ],
  })
  return null
}
