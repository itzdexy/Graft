import type { LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
): Promise<null> {
  onDone('Graft has no subscription tier. Manage your model subscription with your provider, or use /provider to connect another service.', { display: 'system' })
  return null
}
