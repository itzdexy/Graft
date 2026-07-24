import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { buildCoordinatorBrief } from '../../services/blink/agent/coordinator.js'
import { buildCoordinatorAgentPrompt } from '../../services/blink/agent/coordinatorAgent.js'
import { loadAgentSession } from '../../services/blink/agent/persistence.js'
import { getCwd } from '../../utils/cwd.js'

const coordinator: Command = {
  type: 'prompt',
  name: 'coordinator',
  aliases: ['coord'],
  description: 'Show coordinator brief for the active agent session',
  argumentHint: '[help]',
  progressMessage: 'building coordinator brief',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const trimmed = args.trim().toLowerCase()
    if (!trimmed || trimmed === 'help' || trimmed === '?') {
      return [
        {
          type: 'text',
          text: [
            '# Blink coordinator',
            '',
            'Summarizes the active `/agent` session: blockers, conflicts, and next step.',
            '',
            '- `/coordinator` — brief for the current project session',
            '- `/coordinator agent` — full Agent-tool prompt with conflict policy (Phase 5)',
            '- `/agent status` — full step list',
            '- `/timeline` — merged activity view',
          ].join('\n'),
        },
      ]
    }

    const cwd = getCwd()
    const session = loadAgentSession(cwd)
    if (!session) {
      return [
        {
          type: 'text',
          text: 'No agent session for this project. Start one with `/agent start <goal>`.',
        },
      ]
    }

    if (trimmed === 'agent') {
      return [{ type: 'text', text: buildCoordinatorAgentPrompt(session) }]
    }

    return [{ type: 'text', text: buildCoordinatorBrief(session) }]
  },
}

export default coordinator
