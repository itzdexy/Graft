import type { LocalJSXCommandContext } from '../../commands.js'
import { enterAutoMode } from '../../services/tovyr/modes.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<null> {
  const { getAppState, setAppState } = context
  enterAutoMode(getAppState, setAppState, onDone)
  return null
}
