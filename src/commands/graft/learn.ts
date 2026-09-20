import type { Command, LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { learningCommand } from '../../services/graft/learning.js'
import { getCwd } from '../../utils/cwd.js'
export async function call(onDone: LocalJSXCommandOnDone, _context: LocalJSXCommandContext, args: string): Promise<null> {
  try { onDone(learningCommand(getCwd(), args), { display: 'system' }) }
  catch { onDone('Could not save project learning. Check local file permissions.', { display: 'system' }) }
  return null
}
export default { type: 'local-jsx', name: 'learn', description: 'Review and manage local project learning', argumentHint: 'list|remember <preference>|forget <number>|clear|on|off', load: async () => ({ call }) } satisfies Command
