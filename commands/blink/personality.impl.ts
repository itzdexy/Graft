import type { LocalCommandCall } from '../../types/command.js'
import { handlePersonalityCommand } from './personality.js'

export const call: LocalCommandCall = async (args) => ({
  type: 'text',
  value: handlePersonalityCommand(args),
})
