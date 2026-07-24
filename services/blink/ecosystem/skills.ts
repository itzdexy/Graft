import { ECOSYSTEM_UPSTREAMS } from './catalog.js'

/** One-line skill blurbs for /skill ecosystem-* invocations. */
export const ECOSYSTEM_SKILL_BODIES: Record<string, string> = {
  'ecosystem-claude-code': [
    'You are using Blink — an independent terminal coding agent.',
    'Claude models are available via providers; this CLI is Blink, not Claude Code.',
    'Prefer slash commands, skills, and MCP over inventing new workflows.',
    'See /guide for the cheat sheet.',
  ].join('\n'),
  'ecosystem-codex': [
    'Codex-style: respect approval modes (/mode ask|code|bypass).',
    'Maintain AGENTS.md conventions when present.',
    'Small diffs, verify with /verify.',
  ].join('\n'),
  'ecosystem-gemini-cli': [
    'Gemini CLI-style: honor @file paths in user messages as high-priority context.',
    'Use WebFetch for URLs in goals.',
  ].join('\n'),
  'ecosystem-opencode': [
    'OpenCode-style: use /branch for experimental forks.',
    'Prefer LSP-aware edits on typed languages.',
    'Use /experiment new <label> for isolated tries with suggested git branches.',
  ].join('\n'),
  'ecosystem-aider': [
    'Aider-style: use SEARCH/REPLACE blocks for edits.',
    'Use /repo graph for context on large repos.',
    'Offer /git-commit after successful edits.',
    'Post-edit: /verify or lint hints appear automatically when package scripts exist.',
    'Cheat sheet: /aider format | map | lint',
  ].join('\n'),
  'ecosystem-goose': [
    'Goose-style: suggest /recipe workflows for multi-step tasks.',
    'Compose MCP tools before shell one-offs.',
    'Advance active recipes with `/recipe next` after each step completes.',
  ].join('\n'),
  'ecosystem-openhands': [
    'OpenHands-style: for issues use /resolve-issue <url> — reproduce → fix → verify → PR summary.',
    'GitHub issue URLs in plain prompts auto-enrich with the resolver workflow.',
    'Isolation: `/worktree new <name>` before large fixes.',
  ].join('\n'),
  'ecosystem-crush': [
    'Crush-style: concise TUI-friendly replies; bullet progress.',
    'Enable /crush on for compact mode (footer badge).',
  ].join('\n'),
  'ecosystem-plandex': [
    'Plandex-style: capture diffs with /sandbox-diff before declaring done.',
    'Use /ecosystem plan save|list for plan version branches.',
    'Use /superthink for large greenfield work.',
  ].join('\n'),
  'ecosystem-continue': [
    'Continue-style: export rules live in project; follow README test commands.',
    'Sync: `/ecosystem config continue rules` mirrors AGENTS.md → `.continue/rules/blink.md`.',
  ].join('\n'),
  'ecosystem-gpt-engineer': [
    'gpt-engineer-style: scaffold full trees for greenfield; preprompts in /ecosystem template.',
    'For existing repos use /improve (gpt-engineer -i) — minimal diffs, no rescaffold.',
  ].join('\n'),
  'ecosystem-autogpt': [
    'AutoGPT-style: explicit analyze → plan → act → reflect each turn on autonomous tasks.',
    'Use /reflect after a milestone to compare output vs success criteria.',
  ].join('\n'),
  'ecosystem-warp': [
    'Warp-style: when user pastes multi-command scripts, run block-by-block with confirmation.',
    'Use `/warp preview` and `/warp run` for explicit block execution.',
  ].join('\n'),
  'ecosystem-openinterpreter': [
    'Open Interpreter-style: run code via Bash, show output, retry once on failure.',
    'User invokes via /interpret python|js|shell.',
  ].join('\n'),
}

export function listEcosystemSkillIds(): string[] {
  return ECOSYSTEM_UPSTREAMS.map(u => u.skill).filter((s): s is string => !!s)
}

export function formatRampageSkillInvocation(): string {
  const ids = listEcosystemSkillIds()
  return [
    '# Ecosystem rampage — session skills',
    '',
    'Invoke these skills for this session (paste to user):',
    '',
    ...ids.map(id => `- \`/skill ${id}\``),
    '',
    `Total: ${ids.length} upstream adapters.`,
  ].join('\n')
}
