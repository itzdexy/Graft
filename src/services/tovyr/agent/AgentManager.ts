/**
 * Tovyr Agent Manager
 *
 * Orchestrates autonomous agent sessions with persisted state.
 * Implements the agent lifecycle: Observe → Think → Plan → Execute → Verify → Reflect → Continue
 *
 * Sessions are stored in ~/.tovyr/agent/ and persist across Tovyr restarts.
 * Each session tracks goals, steps, phase, and auto-fix configuration.
 *
 * @module services/tovyr/agent/AgentManager
 */

import type { AgentSession } from './types.js'
import { AGENT_PHASE_ORDER } from './types.js'
import { createSession, formatGoalStatus } from './GoalTracker.js'
import { createLoopState } from './loopGuard.js'
import { formatSessionSummaryText } from './sessionSummary.js'
import { planTask } from './TaskPlanner.js'
import {
  clearAgentSession,
  loadAgentSession,
  saveAgentSession,
} from './persistence.js'

export type AgentCommand =
  | 'start'
  | 'status'
  | 'resume'
  | 'stop'
  | 'help'
  | 'verify'
  | 'autofix'
  | 'timeline'
  | 'activity'

export type ParsedAgentArgs = {
  command: AgentCommand
  goal: string
  autoFix: boolean
}

export function parseAgentArgs(args: string): ParsedAgentArgs {
  const trimmed = args.trim()
  if (!trimmed || trimmed === 'help' || trimmed === '?') {
    return { command: 'help', goal: '', autoFix: false }
  }

  let rest = trimmed
  let autoFix = false
  if (/\s--autofix\b/.test(rest) || rest.startsWith('--autofix')) {
    autoFix = true
    rest = rest.replace(/\s--autofix\b/g, '').replace(/^--autofix\s*/, '').trim()
  }

  const [first, ...tail] = rest.split(/\s+/)
  const cmd = first!.toLowerCase()
  const known: AgentCommand[] = [
    'start',
    'resume',
    'status',
    'stop',
    'verify',
    'autofix',
    'timeline',
    'activity',
  ]
  if (known.includes(cmd as AgentCommand)) {
    const goal = tail.join(' ').trim()
    if (cmd === 'autofix') {
      return { command: 'autofix', goal, autoFix: true }
    }
    return {
      command: cmd as AgentCommand,
      goal,
      autoFix: autoFix || cmd === 'start' && autoFix,
    }
  }
  return { command: 'start', goal: rest, autoFix }
}

export class AgentManager {
  constructor(private readonly cwd: string) {}

  getSession(): AgentSession | null {
    return loadAgentSession(this.cwd)
  }

  start(goalText: string, options?: { autoFix?: boolean }): AgentSession {
    if (!goalText.trim()) {
      throw new Error('Goal required. Usage: /agent start <what to accomplish>')
    }
    const steps = planTask(goalText)
    const session = createSession(this.cwd, goalText, steps)
    session.loop = createLoopState()
    if (options?.autoFix) {
      session.autoFix = true
      session.maxAutoFixRounds = 5
      session.autoFixRound = 0
    }
    saveAgentSession(session)
    return session
  }

  resume(): AgentSession {
    const session = loadAgentSession(this.cwd)
    if (!session) {
      throw new Error('No agent session for this project. Use /agent start <goal>.')
    }
    if (session.phase === 'done' || session.phase === 'failed') {
      session.phase = 'continue'
    } else if (session.phase === 'paused') {
      session.phase = 'execute'
    }
    session.updatedAt = Date.now()
    saveAgentSession(session)
    return session
  }

  stop(): boolean {
    return clearAgentSession(this.cwd)
  }

  advancePhase(session: AgentSession): AgentSession {
    const idx = AGENT_PHASE_ORDER.indexOf(session.phase as (typeof AGENT_PHASE_ORDER)[number])
    if (idx >= 0 && idx < AGENT_PHASE_ORDER.length - 1) {
      session.phase = AGENT_PHASE_ORDER[idx + 1]!
    } else if (session.phase === 'continue') {
      session.phase = 'execute'
    }
    session.updatedAt = Date.now()
    saveAgentSession(session)
    return session
  }

  completeCurrentStep(session: AgentSession): AgentSession {
    const step = session.steps[session.currentStepIndex]
    if (step) {
      step.status = 'done'
      step.completedAt = Date.now()
    }
    if (session.currentStepIndex < session.steps.length - 1) {
      session.currentStepIndex += 1
      session.phase = 'observe'
    } else {
      session.phase = 'done'
      session.goal.completedAt = Date.now()
    }
    session.updatedAt = Date.now()
    saveAgentSession(session)
    return session
  }

  statusText(): string {
    const session = loadAgentSession(this.cwd)
    if (!session) return 'No active agent session. Use `/agent start <goal>`.'
    if (session.phase === 'done' || session.phase === 'failed') {
      return formatSessionSummaryText(session)
    }
    return formatGoalStatus(session)
  }

  failSession(session: AgentSession, message: string): AgentSession {
    session.phase = 'failed'
    session.contextNotes = [...session.contextNotes, message].slice(-10)
    if (session.loop) {
      session.loop.stopMessage = message
      session.loop.stopReason = session.loop.stopReason ?? 'user_stop'
    }
    const step = session.steps[session.currentStepIndex]
    if (step && step.status !== 'done') {
      step.status = 'failed'
      step.lastError = message
    }
    session.updatedAt = Date.now()
    saveAgentSession(session)
    return session
  }
}

export function formatAgentHelp(): string {
  return [
    '# Tovyr Agent',
    '',
    'Autonomous coding loop: Observe → Think → Plan → Execute → Verify → Reflect → Continue',
    '',
    '## Commands',
    '- `/agent start <goal>` — create session and run the agent loop',
    '- `/agent start --autofix <goal>` — same, with auto-fix verify loop',
    '- `/agent verify` — run test/lint/build and fix failures',
    '- `/agent autofix` — verify → fix → repeat until green',
    '- `/agent status` — show goal, phase, and step progress',
    '- `/agent timeline` — task timeline (steps, tools, reflections)',
    '- `/agent activity` — recent tool activity feed',
    '- `/timeline` — same timeline view (alias)',
    '- `/agent resume` — continue a paused or completed session',
    '- `/agent stop` — clear session state for this project',
    '',
    '## Specialists (via Agent tool)',
    'Planner, Coder, Reviewer, Debugger, Research, Browser, DevOps, Memory, Benchmark, Coordinator',
    '',
    '## Natural language (CLI)',
    'Pass a goal on the command line — Tovyr routes it automatically:',
    '- `tovyr build a rust web server` → `/build`',
    '- `tovyr fix my failing tests` → `/agent start --autofix …`',
    '- `tovyr deploy staging` → autonomous agent (DevOps specialists)',
    '- `tovyr research vector databases` → `/browser research`',
    '- `tovyr explain this codebase` → `/analyze`',
    '',
    'See `docs/tovyr-agent-roadmap.md` for the full expansion plan.',
  ].join('\n')
}
