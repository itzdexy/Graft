import { answersToContext } from './core.js'
import { extractUrlsFromText } from '../ecosystem/prompt/enrich.js'
import { designDocPath, researchBriefPath } from './researchStore.js'
import type {
  SuperthinkAnswer,
  SuperthinkPlan,
  SuperthinkQuestion,
} from './types.js'

/**
 * Superthinker methodology — obra/superpowers-inspired: brainstorm → design sign-off
 * → bite-sized implementation plan → build with verification. Never jump to code early.
 */
export const SUPERTHINK_METHODOLOGY = [
  'You are in SUPERTHINKER **build** phase. The user already approved the design and plan.',
  '',
  'Hard rules (violating these fails the workflow):',
  '- **Write code now** — use Write/Edit/Bash tools in this turn. Do not ask "shall I proceed?"',
  '- **No new research briefs** — research and Q&A are done; do not output another markdown brief',
  '- **No re-questioning** — the clarified spec below is authoritative',
  '- **YAGNI** — smallest change that meets success criteria',
  '- **Verify** — run build/test/open; never claim done without command output',
  '- **Preview** — for UI work, run `/superthink result <dir>` when something is viewable',
].join('\n')

export function formatSuperthinkHelp(): string {
  return [
    '# ✲ Superthinker mode (Superpowers-style)',
    '',
    'Structured workflow: **research → brainstorm (localhost Q&A) → design sign-off → build → preview**.',
    'Inspired by [obra/superpowers](https://github.com/obra/superpowers).',
    '',
    '## Commands',
    '- `/superthink <goal>` — start or resume (auto-skips completed phases)',
    '- `/superthink continue` — open questionnaire (uses active goal if omitted)',
    '- `/superthink go` — start building after plan approval (`code it` works too)',
    '- `/superthink on` / `off` / `status` — project toggle',
    '- `/superthink result <dir>` — localhost preview of built output',
    '',
    '## Phases',
    '1. **Research** — background subagent saves `research.md` (WebSearch/WebFetch)',
    '2. **Brainstorm** — browser questionnaire + plan preview on localhost',
    '3. **Build** — model writes real code from the approved plan',
    '4. **Preview** — `/superthink result` serves the output',
    '',
    'With mode ON, goals like `build a portfolio site` auto-route here.',
    'Say `code it` or `/superthink go` to continue the **active** goal — not a new one.',
  ].join('\n')
}

/** Phase 1 — model researches; must save file, not chat the whole brief. */
export function buildSuperthinkResearchPrompt(cwd: string, goal: string): string {
  const researchPath = researchBriefPath(cwd, goal)
  const designPath = designDocPath(cwd, goal)
  const urls = extractUrlsFromText(goal).slice(0, 8)
  const urlSection =
    urls.length > 0
      ? ['', '## URLs in goal (WebFetch these first)', ...urls.map(u => `- ${u}`)].join('\n')
      : ''
  return [
    '# ✲ Superthinker — research & brainstorm prep',
    '',
    'You are in **phase 1: research**. Do NOT write application code yet.',
    'This mirrors Superpowers **brainstorming** — understand before building.',
    '',
    `## Goal`,
    goal.trim(),
    urlSection,
    '',
    '## Do now',
    '1. Restate the goal in 2–3 sentences; list unknowns.',
    '2. Research using the **WebSearch** and **WebFetch** tools (invoke them — do not print tool names, slash commands, or special tokens in chat).',
    '3. Save a concise brief to:',
    `   \`${researchPath}\``,
    '   Sections: Summary, Findings (with URLs), Recommended approach, Risks, Open questions.',
    '4. Also save a short design outline to:',
    `   \`${designPath}\``,
    '   First line: `goal: <exact goal text>`',
    '',
    '## After saving',
    'Reply **only** with:',
    '- Confirmation paths',
    '- `Run /superthink continue` (or re-run `/superthink <goal>`) to open the **localhost questionnaire**',
    '',
    'Do **not** paste the full brief into chat. Do **not** start coding.',
    'Do **not** output `<|python_tag|>`, `/websearch`, `/ack`, or similar — use real tools only.',
  ].join('\n')
}

export function buildDesignMarkdown(
  goal: string,
  questions: SuperthinkQuestion[],
  answers: SuperthinkAnswer[],
  plan: SuperthinkPlan,
  researchBrief?: string | null,
): string {
  const lines = [
    `goal: ${goal.trim()}`,
    '',
    '# Design (approved)',
    '',
    plan.summary,
    '',
    '## Clarified spec',
    answersToContext(questions, answers),
    '',
    '## Decisions',
    ...(plan.decisions.length ? plan.decisions.map(d => `- ${d}`) : ['- (none)']),
    '',
    '## Implementation plan',
    ...plan.steps.map((s, i) => `${i + 1}. ${s}`),
  ]
  if (researchBrief?.trim()) {
    lines.push('', '## Research notes', researchBrief.trim().slice(0, 4000))
  }
  return lines.join('\n')
}

/** Waiting for user to complete localhost questionnaire. */
export function buildSuperthinkClarifyWaitMessage(url: string, goal: string): string {
  return [
    `# ✲ Superthinker — brainstorm`,
    '',
    `Questionnaire open: **${url}**`,
    '',
    `Goal: ${goal.trim()}`,
    '',
    'Answer the questions in your browser, review the plan, then click **Approve plan**.',
    'This CLI is **waiting** — when you approve, building starts automatically.',
    '',
    '(If the browser did not open, copy the URL above.)',
  ].join('\n')
}

/** Phase 3 — approved plan; model must implement. */
export function buildSuperthinkBuildPrompt(
  goal: string,
  questions: SuperthinkQuestion[],
  answers: SuperthinkAnswer[],
  plan: SuperthinkPlan,
): string {
  return [
    SUPERTHINK_METHODOLOGY,
    '',
    `## Goal`,
    goal.trim(),
    '',
    '## Clarified spec (user answers — authoritative)',
    answersToContext(questions, answers),
    '',
    '## Approved implementation plan',
    plan.summary,
    ...(plan.decisions.length
      ? ['', 'Decisions:', ...plan.decisions.map(d => `- ${d}`)]
      : []),
    '',
    '### Tasks (execute in order, use tools on each)',
    ...plan.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    '**Start task 1 now.** Create/edit files with tools. Show progress as you go.',
  ].join('\n')
}

/** User tried to build but plan is not approved yet. */
export function buildSuperthinkNeedClarifyMessage(goal: string): string {
  return [
    `Plan not approved yet for: **${goal.trim()}**`,
    '',
    'Run `/superthink continue` to open the localhost questionnaire and approve the plan first.',
    'Or re-run `/superthink ' + goal.trim() + '` — research is saved, so it will skip to brainstorm.',
  ].join('\n')
}

/** Research done; prompt user that questionnaire will open. */
export function buildSuperthinkResearchDoneMessage(goal: string): string {
  return [
    `Research found for: **${goal.trim()}**`,
    '',
    'Opening the localhost brainstorm questionnaire next…',
    'Complete it in your browser, approve the plan, then implementation begins.',
  ].join('\n')
}
