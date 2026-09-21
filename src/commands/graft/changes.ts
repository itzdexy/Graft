import type { Command, LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { getChangePreview } from '../../services/graft/git/changePreview.js'
import { getCwd } from '../../utils/cwd.js'

export async function call(onDone: LocalJSXCommandOnDone, _context: LocalJSXCommandContext): Promise<null> {
  try { onDone(await getChangePreview(getCwd()), { display: 'system' }) }
  catch { onDone('Could not inspect Git changes in this folder.', { display: 'system' }) }
  return null
}

export default { type: 'local-jsx', name: 'changes', description: 'Preview staged and working-tree changes without a model request', load: async () => ({ call }) } satisfies Command
