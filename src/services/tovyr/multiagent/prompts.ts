import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { TOVYR_CRITIQUE_FILENAME } from '../../../constants/tovyr.js'
import { formatMemoryForPrompt, loadProjectMemory } from '../buddy/memory.js'
import { CRITIQUE_PAIRS } from './modes.js'
import { formatCritiqueUsage, type ParsedCritiqueArgs } from './parseArgs.js'

const ORCHESTRATOR_HEADER = `You orchestrate a multi-agent critique session inside Tovyr.

Rules:
- Simulate two distinct agents with separate voices — do NOT blend them into one narrator.
- Each round: Primary produces work → Critic reviews → Primary may revise (except final round).
- Use real tools (Read, Grep, etc.) when the task touches this repository — critics must cite evidence.
- Be honest about disagreements; note when the critic is wrong or the primary missed something.
- End with a Breakdown Analysis that catalogs where agents failed, hallucinated, or over-corrected.
- Save the full transcript to ${TOVYR_CRITIQUE_FILENAME} in the project root when finished.`

function buildRoundInstructions(rounds: number, primaryLabel: string, criticLabel: string): string {
  const lines: string[] = [`Run exactly ${rounds} critique round(s).`]
  for (let i = 1; i <= rounds; i++) {
    const isLast = i === rounds
    lines.push(
      '',
      `### Round ${i}`,
      `1. **${primaryLabel}** — ${isLast ? 'final' : 'draft or revised'} output for the task`,
      `2. **${criticLabel}** — structured critique (Strengths · Issues · Must-fix · Nice-to-have)`,
    )
    if (!isLast) {
      lines.push(`3. **${primaryLabel}** — brief response to critique and revised output`)
    }
  }
  return lines.join('\n')
}

export function critiquePrompt(cwd: string, parsed: ParsedCritiqueArgs): ContentBlockParam[] {
  const pair = CRITIQUE_PAIRS[parsed.pair]
  const memory = formatMemoryForPrompt(loadProjectMemory(cwd))
  const task =
    parsed.task ||
    'No specific task provided — pick a small, concrete artifact in this repo (e.g. a function, doc section, or recent change) and run a demo critique session.'

  const body = [
    ORCHESTRATOR_HEADER,
    '',
    `## Session config`,
    `- Pair: ${pair.label}`,
    `- Rounds: ${parsed.rounds}`,
    `- Task: ${task}`,
    `- Target deliverable: ${pair.deliverable}`,
    '',
    `## Agent personas`,
    `**${pair.primary.label}:** ${pair.primary.persona}`,
    `**${pair.critic.label}:** ${pair.critic.persona}`,
    '',
    buildRoundInstructions(parsed.rounds, pair.primary.label, pair.critic.label),
    '',
    '## Output format',
    'Use markdown headers for each agent turn, e.g.:',
    `## Round 1 — ${pair.primary.label}`,
    `## Round 1 — ${pair.critic.label}`,
    '',
    '## Final sections (required)',
    '### Synthesis',
    'What the pair agreed on and the best combined result.',
    '',
    '### Breakdown Analysis',
    'Explore where agents break down:',
    '- Primary failures (wrong assumptions, skipped edge cases, style drift)',
    '- Critic failures (false positives, missed bugs, nitpicking vs substance)',
    '- Orchestration failures (talking past each other, scope creep, premature consensus)',
    '- Confidence: rate final artifact 0–100% with one-line rationale',
    '',
    'If the Agent tool is available, you MAY spawn subagents for primary and critic roles — otherwise simulate with labeled sections.',
  ].join('\n')

  const text = memory ? `${memory}\n\n${body}` : body
  return [{ type: 'text', text }]
}

export function critiqueHelpPrompt(): ContentBlockParam[] {
  return [{ type: 'text', text: formatCritiqueUsage() }]
}
