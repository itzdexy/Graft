import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { BLINK_PLAN_FILENAME } from '../../../constants/blink.js'
import { formatMemoryForPrompt, loadProjectMemory } from '../buddy/memory.js'
import { formatIntentHint } from '../intent/router.js'
import { buildCoordinatorBrief } from './coordinator.js'
import { buildSpecialistHandoff, previousSpecialistRole } from './handoffs.js'
import { formatLoopGuardPrompt } from './loopGuard.js'
import { getSpecialistInstructions } from './specialists.js'
import type { AgentSession } from './types.js'
import { AGENT_PHASE_ORDER } from './types.js'
import { formatPlanForPrompt } from './TaskPlanner.js'
import { buildReflectionPrompt } from './ReflectionEngine.js'
import { buildVerifyStepPrompt } from '../verify/verifyPrompts.js'
import { getVerifyCommandsForPrompt } from '../verify/VerifyEngine.js'

const LOOP_HEADER = `You are Blink's autonomous agent orchestrator.

Follow the agent loop for the active step:
**Observe → Think → Plan → Execute → Verify → Reflect → Continue**

Rules:
- Work on ONE step at a time unless explicitly parallelizing via the Agent tool.
- Use real tools (Read, Grep, Edit, Bash, Agent, WebFetch, WebSearch) — do not hallucinate file contents.
- After Verify, run Reflection before marking the step done.
- On errors: diagnose, retry with a different approach (up to max retries), then escalate.
- Prefer minimal diffs; match existing project style.
- Save a concise plan to ${BLINK_PLAN_FILENAME} when the Plan step completes.
- On verify: run project test/lint/build commands; use \`/verify\` or Bash — never claim green without output.
- Auto-fix mode: Read → Edit → Verify → repeat until passes or max rounds.
- Never repeat an identical failed tool call — change the command, path, or strategy.
- If the model output would be empty, output a short status instead.`

export function buildExecutionPrompt(session: AgentSession): ContentBlockParam[] {
  const step = session.steps[session.currentStepIndex]
  const memory = formatMemoryForPrompt(loadProjectMemory(session.cwd))
  const specialistBlock = step?.specialist
    ? getSpecialistInstructions(step.specialist)
    : ''

  const body = [
    LOOP_HEADER,
    '',
    '## Session',
    `- Goal: ${session.goal.text}`,
    `- Phase: ${session.phase}`,
    `- Step ${session.currentStepIndex + 1}/${session.steps.length}: ${step?.title ?? '(none)'}`,
    '',
    '## Intent routing',
    formatIntentHint(session.goal.text),
  ]

  if (session.phase === 'continue' || session.phase === 'reflect') {
    body.push('', buildCoordinatorBrief(session))
  }

  if (step) {
    body.push(
      '',
      '## Active step',
      step.description,
      '',
      specialistBlock,
    )
    const prev = previousSpecialistRole(session)
    if (step.specialist && prev && prev !== step.specialist) {
      body.push('', buildSpecialistHandoff(session, prev, step.specialist))
    }
  }

  body.push(
    '',
    formatLoopGuardPrompt(session),
    '',
    '## Full plan',
    formatPlanForPrompt(session.steps),
    '',
    '## Acceptance criteria',
    ...session.goal.acceptanceCriteria.map(c => `- ${c}`),
    '',
    '## Project verify commands',
    getVerifyCommandsForPrompt(session.cwd),
    '',
  )

  if (step?.title.toLowerCase().includes('verify') || session.phase === 'verify') {
    body.push(buildVerifyStepPrompt(session), '')
  }

  if (session.autoFix) {
    body.push(
      '## Auto-fix mode',
      'After each edit batch, re-run failed verify commands. Max rounds: ' +
        String(session.maxAutoFixRounds ?? 5),
      'Use /code or /bypass if the user wants edits auto-accepted.',
      '',
    )
  }

  body.push(
    buildReflectionPrompt(session),
    '',
    '## Phase guide',
    AGENT_PHASE_ORDER.map((p, i) => `${i + 1}. ${p}`).join('\n'),
    '',
    'When this step is complete, output:',
    '### Step complete',
    '- Summary of what was done',
    '- Files touched',
    '- Verification results',
    'Then proceed to the next step in the same turn if context allows.',
  )

  const text = memory ? `${memory}\n\n${body.join('\n')}` : body.join('\n')
  return [{ type: 'text', text }]
}

export function buildStatusPrompt(session: AgentSession): ContentBlockParam[] {
  const step = session.steps[session.currentStepIndex]
  const text = [
    'Print the current Blink agent session status for the user (no tools):',
    '',
    `Goal: ${session.goal.text}`,
    `Phase: ${session.phase}`,
    `Step: ${session.currentStepIndex + 1}/${session.steps.length} — ${step?.title ?? 'n/a'} (${step?.status ?? 'n/a'})`,
    '',
    'Steps:',
    ...session.steps.map((s, i) => {
      const cur = i === session.currentStepIndex ? ' (current)' : ''
      return `- [${s.status}] ${s.title}${cur}`
    }),
  ].join('\n')
  return [{ type: 'text', text }]
}
