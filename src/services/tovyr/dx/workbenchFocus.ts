import type { Command } from '../../../commands.js'
import type { WorkbenchFocus } from './workbench.js'

/** Resolve focused workbench evidence from an enabled, user-invoked command. */
export function resolveWorkbenchFocusFromCommand(
  input: string,
  commands: readonly Command[],
  isEnabled: (command: Command) => boolean,
): WorkbenchFocus {
  const match = input.trim().match(/^\/([^\s]+)/)
  if (!match) return 'none'
  const commandName = match[1]
  const command = commands.find(
    candidate =>
      isEnabled(candidate) &&
      (candidate.name === commandName || candidate.aliases?.includes(commandName)),
  )
  return command?.name === 'files' ? 'file' : 'none'
}
