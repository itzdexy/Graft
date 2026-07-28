import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  buildAutoFixExhaustedPrompt,
  buildAutoFixPrompt,
  isAutoFixBudgetExhausted,
  verifyPromptForCwd,
} from '../verify/verifyPrompts.js'
import {
  formatVerificationReport,
  runVerification,
} from '../verify/VerifyEngine.js'
import {
  buildTaskTimeline,
  formatTimelineMarkdown,
} from '../dx/taskTimeline.js'
import {
  formatToolActivityLines,
} from '../dx/agentStatus.js'
import { getRecentToolActivity } from '../dx/activityStore.js'
import { AgentManager, formatAgentHelp, parseAgentArgs } from './AgentManager.js'
import {
  buildExecutionPrompt,
  buildStatusPrompt,
} from './ExecutionEngine.js'
import { loadAgentSession, saveAgentSession } from './persistence.js'

export async function agentPrompt(
  cwd: string,
  args: string,
): Promise<ContentBlockParam[]> {
  const { command, goal, autoFix } = parseAgentArgs(args)
  const manager = new AgentManager(cwd)

  switch (command) {
    case 'help':
      return [{ type: 'text', text: formatAgentHelp() }]

    case 'status': {
      const session = manager.getSession()
      if (!session) {
        return [{ type: 'text', text: manager.statusText() }]
      }
      return buildStatusPrompt(session)
    }

    case 'stop': {
      const cleared = manager.stop()
      return [
        {
          type: 'text',
          text: cleared
            ? 'Agent session cleared for this project.'
            : 'No agent session was active.',
        },
      ]
    }

    case 'verify':
      return verifyPromptForCwd(cwd, goal || undefined)

    case 'autofix': {
      const session = manager.getSession() ?? (goal ? manager.start(goal, { autoFix: true }) : null)
      if (!session) {
        return [
          {
            type: 'text',
            text: 'Start an agent session first (`/agent start <goal>`) or pass a goal with `/agent autofix <goal>`.',
          },
        ]
      }
      session.autoFix = true
      session.autoFixRound = (session.autoFixRound ?? 0) + 1
      session.maxAutoFixRounds = session.maxAutoFixRounds ?? 5
      session.phase = 'verify'
      saveAgentSession(session)

      const report = await runVerification(cwd)
      const reportText = formatVerificationReport(report)
      if (report.allPassed) {
        return [
          {
            type: 'text',
            text: `${reportText}\n\nAll checks passed. Mark verify step complete and continue the agent goal.`,
          },
        ]
      }
      // Stop and escalate once the round budget is spent — otherwise a build
      // that never goes green would loop forever, burning turns and tokens.
      if (
        isAutoFixBudgetExhausted(session.autoFixRound, session.maxAutoFixRounds)
      ) {
        return buildAutoFixExhaustedPrompt(
          session,
          reportText,
          session.maxAutoFixRounds,
        )
      }
      return buildAutoFixPrompt(
        session,
        reportText,
        session.autoFixRound,
        session.maxAutoFixRounds,
      )
    }

    case 'timeline': {
      const session = manager.getSession()
      if (!session) {
        return [
          {
            type: 'text',
            text: 'No agent session for this project. Use `/agent start <goal>`.',
          },
        ]
      }
      const stored = getRecentToolActivity(cwd)
      const events = buildTaskTimeline(session, stored)
      return [
        {
          type: 'text',
          text: formatTimelineMarkdown(events),
        },
      ]
    }

    case 'activity': {
      const lines = formatToolActivityLines(getRecentToolActivity(cwd))
      return [
        {
          type: 'text',
          text: [
            '# Tool activity',
            '',
            lines.length ? lines.join('\n') : '_No tools recorded yet this session._',
          ].join('\n'),
        },
      ]
    }

    case 'resume': {
      const session = manager.resume()
      return buildExecutionPrompt(session)
    }

    case 'start':
    default: {
      const existing = loadAgentSession(cwd)
      let session = existing
      if (goal) {
        session = manager.start(goal, { autoFix })
      }
      if (!session) {
        return [
          {
            type: 'text',
            text: 'Usage: `/agent start <goal>` or `/agent start --autofix <goal>`\n\n' + formatAgentHelp(),
          },
        ]
      }
      return buildExecutionPrompt(session)
    }
  }
}
