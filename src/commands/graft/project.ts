import type { Command, LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { formatProjectOverview, getProjectOverview } from '../../services/graft/projectOverview.js'
import { getCwd } from '../../utils/cwd.js'

export async function call(onDone: LocalJSXCommandOnDone, _context: LocalJSXCommandContext): Promise<null> {
  try { onDone(formatProjectOverview(await getProjectOverview(getCwd())), { display: 'system' }) }
  catch { onDone('Could not read this project folder. Check that it exists and is accessible.', { display: 'system' }) }
  return null
}

export default { type: 'local-jsx', name: 'project', description: 'Show a local project overview without a model request', load: async () => ({ call }) } satisfies Command
