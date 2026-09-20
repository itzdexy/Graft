import type { Command, LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { collectConversationSources, formatConversationSources } from '../../services/graft/web/conversationSources.js'

export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext): Promise<null> {
  onDone(formatConversationSources(collectConversationSources(context.messages ?? [])), { display: 'system' })
  return null
}
export default { type: 'local-jsx', name: 'sources', description: 'Show fetched pages and search links from this conversation', load: async () => ({ call }) } satisfies Command
