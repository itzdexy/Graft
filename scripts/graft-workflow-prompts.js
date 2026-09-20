/**
 * Shell workflow prompts — used by `graft review|fix|plan|ask`.
 */

/** @typedef {'review' | 'fix' | 'plan' | 'ask'} WorkflowKind */

/** @type {Record<WorkflowKind, (scope: string) => string>} */
export const WORKFLOW_PROMPT_BUILDERS = {
  ask: scope => scope,
  review: scope =>
    [
      'You are a senior engineer doing a code review. Be direct and specific.',
      'Check for: bugs and logic errors, security issues (injection, auth, data exposure), performance problems, maintainability concerns.',
      'Label each finding: Critical / Warning / Suggestion. Skip nitpicks.',
      'Read the actual files — do not guess at code that is not shown.',
      scope ? `\nScope: ${scope}` : '\nScope: uncommitted changes in the working tree (run git diff to find them).',
    ].join('\n'),
  fix: scope =>
    [
      'Fix the described issue with the smallest correct change.',
      'Steps: read the relevant files, make the fix, run tests or lint if available, summarize exactly what changed and why.',
      'Do not refactor surrounding code or add features beyond the fix.',
      scope ? `\nGoal: ${scope}` : '\nGoal: identify and fix the most pressing issue in the working tree.',
    ].join('\n'),
  plan: scope =>
    [
      'Draft a concrete implementation plan. Do not write any code yet.',
      'Include: numbered phases, key files to create or modify, risks and open questions, rough effort estimate.',
      'If a graftplan.md already exists, update it; otherwise create it.',
      scope ? `\nTask: ${scope}` : '\nTask: plan the next meaningful feature or improvement for this repository.',
    ].join('\n'),
}

/**
 * Build argv for print mode from a workflow command.
 * @param {WorkflowKind} kind
 * @param {string[]} restArgs
 * @returns {string[]}
 */
export function buildWorkflowPrintArgs(kind, restArgs) {
  const scope = restArgs.filter(a => !a.startsWith('-')).join(' ').trim()
  const flags = restArgs.filter(a => a.startsWith('-'))
  const prompt = WORKFLOW_PROMPT_BUILDERS[kind](scope)
  const hasPrint = flags.includes('-p') || flags.includes('--print')
  if (hasPrint) {
    return [...flags, prompt]
  }
  return ['-p', ...flags, prompt]
}
