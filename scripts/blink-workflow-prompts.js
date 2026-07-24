/**
 * Shell workflow prompts — used by `blink review|fix|plan|ask`.
 */

/** @typedef {'review' | 'fix' | 'plan' | 'ask'} WorkflowKind */

/** @type {Record<WorkflowKind, (scope: string) => string>} */
export const WORKFLOW_PROMPT_BUILDERS = {
  ask: scope => scope,
  review: scope =>
    [
      'Senior code review. Check bugs, security, maintainability, and performance.',
      'Use severity labels: Critical / Warning / Suggestion.',
      'Inspect the git working tree and cited files — do not guess.',
      scope ? `\nScope: ${scope}` : '\nScope: uncommitted changes and recent edits.',
    ].join('\n'),
  fix: scope =>
    [
      'Fix the issue with the smallest correct change. Read relevant files first.',
      'Run tests or lint when available. Summarize what changed.',
      scope ? `\nGoal: ${scope}` : '\nGoal: fix issues in the working tree.',
    ].join('\n'),
  plan: scope =>
    [
      'Draft an implementation plan with numbered phases, risks, and files to touch.',
      'Save the plan to blinkplan.md when appropriate. Do not implement until asked.',
      scope ? `\nTask: ${scope}` : '\nTask: plan the next feature for this repository.',
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
