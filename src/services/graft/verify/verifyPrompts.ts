import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { AgentSession } from '../agent/types.js'
import { getVerifyCommandsForPrompt } from './VerifyEngine.js'
import { detectProjectScripts, formatProjectScripts, type VerifyCheckKind } from './projectScripts.js'

export type AutoFixOptions = {
  maxRounds?: number
}

const DEFAULT_AUTOFIX_ROUNDS = 5

export function buildVerifyStepPrompt(session: AgentSession): string {
  return [
    '## Verify step (required)',
    getVerifyCommandsForPrompt(session.cwd),
    '',
    'Run the checks above via Bash in order: typecheck → lint → test → build (skip missing).',
    'If any fail, capture output and fix before marking this step complete.',
    'Prefer `Read → Edit → Bash(verify)` loops until green or max retries.',
  ].join('\n')
}

export function buildAutoFixPrompt(
  session: AgentSession,
  reportText: string,
  round: number,
  maxRounds: number,
): ContentBlockParam[] {
  const text = [
    '# Graft Auto-fix mode',
    '',
    `Goal: ${session.goal.text}`,
    `Auto-fix round ${round}/${maxRounds}`,
    '',
    '## Verification results',
    reportText,
    '',
    '## Instructions',
    '1. Read files cited in errors',
    '2. Apply minimal fixes (Edit/MultiEdit)',
    '3. Re-run failed verify commands via Bash',
    '4. Repeat until all pass or you need user input',
    '',
    'Do not claim success without running verify commands again.',
    session.autoFix
      ? 'Auto-fix is ON — proceed without asking permission for routine edits.'
      : 'Ask before destructive or wide-reaching changes.',
  ].join('\n')
  return [{ type: 'text', text }]
}

export async function verifyPromptForCwd(
  cwd: string,
  kinds?: string,
): Promise<ContentBlockParam[]> {
  const requested = [...new Set(kinds?.toLowerCase().split(/[,\s]+/).filter(Boolean) ?? [])]
  const allowed = ['typecheck', 'lint', 'test', 'build']
  const invalid = requested.filter(kind => !allowed.includes(kind))
  if (invalid.length) return [{ type: 'text', text: `Unknown verification kind: ${invalid.join(', ')}. Use /verify [typecheck|lint|test|build]. Do not run checks for this invalid request.` }]
  const scripts = detectProjectScripts(cwd)
  const checks = scripts.checks.filter(check => !requested.length || requested.includes(check.kind))
  const missing = requested.filter(kind => !checks.some(check => check.kind === kind))
  return [{ type: 'text', text: [
    '# Verify this project',
    `Working directory: ${JSON.stringify(cwd)}`,
    formatProjectScripts({ ...scripts, checks }),
    missing.length ? `Not configured: ${missing.join(', ')}. Report these as skipped, not passed.` : '',
    checks.length ? 'Run each detected command through the normal shell tool in the working directory above. Respect the active permission mode and cancellation. Do not execute in a different project directory.' : 'No matching checks are configured. Report that verification was not run; do not invent fallback commands.',
    'Inspect the script definitions before running them. A check may invoke project-defined code; do not run deployment, publishing, destructive, or fix scripts as verification.',
    'Report each command, exit status, and the useful failure output. Preserve both stdout and stderr. A timeout, cancellation, skipped check, or missing command is not a pass.',
    'Verification alone does not authorize source changes. Report failures and distinguish pre-existing issues where evidence allows. If the user also requested fixes, make targeted changes and rerun the affected checks.',
  ].filter(Boolean).join('\n') }]
}

export function autoFixRounds(session: AgentSession): number {
  return session.maxAutoFixRounds ?? DEFAULT_AUTOFIX_ROUNDS
}

/**
 * True once the auto-fix loop has consumed its full round budget, so the caller
 * must stop and escalate instead of issuing another fix prompt. Without this the
 * round counter is purely cosmetic and a never-passing build loops forever.
 */
export function isAutoFixBudgetExhausted(
  round: number,
  maxRounds: number,
): boolean {
  const cap =
    Number.isFinite(maxRounds) && maxRounds > 0 ? maxRounds : DEFAULT_AUTOFIX_ROUNDS
  return round > cap
}

/**
 * Terminal prompt for when auto-fix can't reach green within budget: tell the
 * model to stop editing and hand control back to the user with a clear summary,
 * the way Codex/Graft escalate rather than burning turns indefinitely.
 */
export function buildAutoFixExhaustedPrompt(
  session: AgentSession,
  reportText: string,
  maxRounds: number,
): ContentBlockParam[] {
  const text = [
    '# Graft Auto-fix — budget exhausted',
    '',
    `Goal: ${session.goal.text}`,
    `Auto-fix stopped after ${maxRounds} round(s) without all checks passing.`,
    '',
    '## Latest verification results',
    reportText,
    '',
    '## Stop and escalate (do NOT keep auto-fixing)',
    'Summarize for the user instead of editing further:',
    '- which checks still fail and the key error(s)',
    '- what was attempted across the auto-fix rounds',
    '- a concrete next step or question to unblock (missing dependency,',
    '  ambiguous requirement, flaky/environmental failure, etc.).',
    'Wait for the user to decide before making more changes.',
  ].join('\n')
  return [{ type: 'text', text }]
}
