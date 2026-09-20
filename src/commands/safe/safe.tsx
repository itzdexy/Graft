import type { LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { enterSafeMode } from '../../services/graft/modes.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<null> {
  const { getAppState, setAppState } = context
  enterSafeMode(getAppState, setAppState, onDone)
  return null
}
