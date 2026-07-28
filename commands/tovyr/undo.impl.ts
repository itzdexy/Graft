import type { LocalCommandCall } from '../../types/command.js'
import { undoLastTurn } from './undo.js'

export const call: LocalCommandCall = async (args, context) => undoLastTurn(context, args)
