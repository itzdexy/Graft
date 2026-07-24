import type { LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { enterCodeMode } from '../../services/blink/modes.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<null> {
  const { getAppState, setAppState } = context
  enterCodeMode(getAppState, setAppState, onDone)
  return null
}
