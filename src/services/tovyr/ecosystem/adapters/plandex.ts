/** Plandex-inspired helpers beyond diff sandbox. */
export { formatPlanVersionList, listPlanVersions, savePlanVersion } from '../sandbox/planVersions.js'
export type { PlanVersion } from '../sandbox/planVersions.js'

export const PLANDEX_WORKFLOW_REMINDER = [
  'Plandex-style workflow:',
  '1. Chat/plan without touching main tree when possible',
  '2. `/sandbox-diff capture` before declaring done',
  '3. `/ecosystem plan list <goal>` to compare plan branches',
  '4. `/superthink` for phased research → build on large tasks',
].join('\n')
