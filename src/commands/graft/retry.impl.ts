import type { LocalCommandCall } from '../../types/command.js'
import { retryLastTurn } from './retry.js'

export const call: LocalCommandCall = async (_args, context) =>
  retryLastTurn(context)
