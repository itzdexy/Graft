import { isSuperthinkEnabled } from '../superthink/state.js'
import { getActiveSuperthinkGoal } from '../superthink/sessionStore.js'
import { isCrushModeEnabled } from './crush/state.js'
import { getActiveExperimentFork } from './opencode/forkStore.js'
import { formatRecipeSessionStatus } from './recipes/recipeSession.js'
import { listWorktreePlans } from './openhands/worktree.js'
import { isProjectRepoIndexEnabled } from '../repo/projectCache.js'
import { isVectorMemoryEnabled } from '../memory/vector.js'
import { formatVoiceStatus } from '../voice/index.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { continueRulesPath } from './continue/syncRules.js'

export function formatEcosystemStatus(cwd: string): string {
  const lines = ['# Ecosystem status', '']

  lines.push(`- **Superthink**: ${isSuperthinkEnabled(cwd) ? 'on' : 'off'}`)
  const goal = getActiveSuperthinkGoal(cwd)
  if (goal) lines.push(`  - Active goal: ${goal.slice(0, 80)}`)

  lines.push(`- **Crush compact**: ${isCrushModeEnabled(cwd) ? 'on' : 'off'}`)

  const fork = getActiveExperimentFork(cwd)
  lines.push(
    fork
      ? `- **Experiment fork**: ${fork.label} (\`${fork.forkId.slice(0, 8)}…\`)`
      : '- **Experiment fork**: none',
  )

  const recipe = formatRecipeSessionStatus(cwd)
  lines.push(recipe ? `- **Goose recipe**: ${recipe}` : '- **Goose recipe**: none')

  const worktrees = listWorktreePlans(cwd).length
  lines.push(`- **OpenHands worktrees**: ${worktrees} plan(s) saved`)

  const rules = existsSync(continueRulesPath(cwd))
  lines.push(
    rules
      ? `- **Continue rules**: synced at \`${continueRulesPath(cwd)}\``
      : '- **Continue rules**: not synced — `/ecosystem config continue rules`',
  )

  const execExists = existsSync(join(cwd, 'execpolicy.md'))
  lines.push(
    execExists ? '- **execpolicy.md**: present' : '- **execpolicy.md**: missing',
  )

  lines.push('', '## Roadmap flags')
  lines.push(`- **Project repo index**: ${isProjectRepoIndexEnabled() ? 'on' : 'off'} (TOVYR_REPO_INDEX_LOCAL)`)
  lines.push(`- **Vector memory**: ${isVectorMemoryEnabled() ? 'on' : 'off'} (TOVYR_VECTOR_MEMORY)`)
  lines.push(`- **Voice**: ${formatVoiceStatus()}`)

  lines.push('', 'Toggle: `/crush on` · `/superthink on` · `/roadmap`')
  return lines.join('\n')
}
