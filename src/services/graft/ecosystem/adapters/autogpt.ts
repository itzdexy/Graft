export const AUTOGPT_CHAIN_STEPS = [
  { step: 1, name: 'Analyze', action: 'Gather context, define success criteria' },
  { step: 2, name: 'Plan', action: 'Break into ordered subtasks' },
  { step: 3, name: 'Act', action: 'Execute tools; one subtask at a time' },
  { step: 4, name: 'Reflect', action: 'Check output vs criteria; adjust plan' },
  { step: 5, name: 'Complete', action: 'Summarize; suggest `/verify` and `/git-commit`' },
] as const

export function formatAutoGptChain(): string {
  return AUTOGPT_CHAIN_STEPS.map(s => `${s.step}. **${s.name}** — ${s.action}`).join('\n')
}

export function formatAutoGptHelp(): string {
  return [
    '# AutoGPT patterns',
    '',
    'Autonomous agent chains — analyze, plan, act, reflect.',
    '',
    '## Commands',
    '- `/chain start <goal>` — full analyze → plan → act → reflect loop',
    '- `/reflect` — explicit reflect phase after a milestone',
    '- `/agent start` — longer autonomous agent session',
    '',
    '## Chain steps',
    formatAutoGptChain(),
  ].join('\n')
}
