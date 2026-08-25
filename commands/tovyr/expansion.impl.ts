import type { LocalCommandCall } from '../../types/command.js'
import { getCwd } from '../../utils/cwd.js'
import { formatExpansionStatusTable } from '../../services/tovyr/expansion/index.js'
import { startAgentServer } from '../../agents/AgentServer.js'
import { runAgent } from '../../agents/AgentSDK.js'

/**
 * Only expose extensions that are part of the source distribution. Historical
 * experimental commands referenced optional, unshipped modules and made the
 * production REPL fail at import time.
 */
export const call: LocalCommandCall = async (args, context) => {
  const subcommand = args.trim().toLowerCase()
  if (!subcommand || subcommand === 'status' || subcommand === 'list') {
    const mode = context.getAppState?.()?.toolPermissionContext?.mode
    return { type: 'text', value: formatExpansionStatusTable({ permissionMode: mode }) }
  }

  if (subcommand === 'serve') {
    const cwd = getCwd()
    const handle = await startAgentServer(
      { host: '127.0.0.1', port: 9477 },
      async ({ prompt, sessionId }) => {
        const run = await runAgent({ prompt, sessionId, cwd })
        const lastAssistant = [...run.messages].reverse().find(message => message.role === 'assistant')
        return {
          sessionId: run.sessionId,
          result: run.success
            ? (lastAssistant?.content ?? '(no response)')
            : (run.error ?? 'Agent run failed'),
        }
      },
    )
    return {
      type: 'text',
      value: `Agent server listening at ${handle.url}\nPOST /v1/agent/run with {"prompt":"..."}`,
    }
  }

  return {
    type: 'text',
    value: `Unknown /expansion command: ${subcommand}\n\n${formatExpansionStatusTable()}`,
  }
}
