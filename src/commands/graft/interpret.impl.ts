import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  buildOpenInterpreterPrompt,
  parseInterpretArgs,
} from '../../services/graft/ecosystem/adapters/openinterpreter.js'

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const parsed = parseInterpretArgs(args)
  if (!parsed) {
    onDone(
      'Usage: `/interpret python <code>` · `/interpret js …` · `/interpret shell …`',
      { display: 'system' },
    )
    return null
  }

  onDone(undefined, {
    shouldQuery: true,
    metaMessages: [buildOpenInterpreterPrompt(parsed.lang, parsed.code)],
  })
  return null
}
