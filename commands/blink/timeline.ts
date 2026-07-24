import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { loadAgentSession } from '../../services/blink/agent/persistence.js'
import { formatToolActivityLines } from '../../services/blink/dx/agentStatus.js'
import { getRecentToolActivity } from '../../services/blink/dx/activityStore.js'
import { extractRecentToolUses } from '../../services/blink/dx/messageScanner.js'
import {
  buildTaskTimeline,
  formatTimelineMarkdown,
} from '../../services/blink/dx/taskTimeline.js'
import { getCwd } from '../../utils/cwd.js'

function parseTimelineArgs(args: string): { mode: 'full' | 'tools' | 'help' } {
  const t = args.trim().toLowerCase()
  if (!t || t === 'help' || t === '?') return { mode: 'help' }
  if (t === 'tools' || t === 'activity') return { mode: 'tools' }
  return { mode: 'full' }
}

const timeline: Command = {
  type: 'prompt',
  name: 'timeline',
  aliases: ['agent-timeline'],
  description: 'Show agent task timeline and recent tool activity',
  argumentHint: '[tools|help]',
  progressMessage: 'building agent timeline',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const { mode } = parseTimelineArgs(args)
    const cwd = getCwd()

    if (mode === 'help') {
      return [
        {
          type: 'text',
          text: [
            '# Blink timeline',
            '',
            'Developer-experience view of the active `/agent` session.',
            '',
            '- `/timeline` — merged timeline (steps, reflections, tools, phase)',
            '- `/timeline tools` — recent tool activity only',
            '',
            'The REPL footer shows a compact HUD while an agent session is running.',
          ].join('\n'),
        },
      ]
    }

    const session = loadAgentSession(cwd)
    if (!session) {
      return [
        {
          type: 'text',
          text: 'No agent session for this project. Start one with `/agent start <goal>`.',
        },
      ]
    }

    if (mode === 'tools') {
      const stored = getRecentToolActivity(cwd)
      const lines = formatToolActivityLines(stored)
      return [
        {
          type: 'text',
          text: [
            '# Tool activity',
            '',
            lines.length ? lines.join('\n') : '_No tools recorded this session yet._',
            '',
            'Tools are captured during the REPL loop when Blink runtime is active.',
          ].join('\n'),
        },
      ]
    }

    const stored = getRecentToolActivity(cwd)
    const scanned = extractRecentToolUses([])
    const events = buildTaskTimeline(session, stored, scanned)
    const body = formatTimelineMarkdown(events)

    return [
      {
        type: 'text',
        text: `${body}\n\nUse \`/agent status\` for step details or \`/timeline tools\` for tool feed.`,
      },
    ]
  },
}

export default timeline
