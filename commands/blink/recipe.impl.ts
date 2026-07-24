import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  formatGooseRecipeList,
  formatGooseRecipeRun,
  getGooseRecipe,
} from '../../services/blink/ecosystem/recipes/gooseRecipes.js'
import {
  advanceRecipeSession,
  clearRecipeSession,
  formatRecipeSessionStatus,
  getRecipeSession,
  startRecipeSession,
} from '../../services/blink/ecosystem/recipes/recipeSession.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const trimmed = args.trim()
  const cwd = getCwd()

  if (!trimmed || trimmed === 'list') {
    const status = formatRecipeSessionStatus(cwd)
    onDone(
      [
        '# Goose recipes',
        '',
        status ? `**Active:** ${status}\n` : '',
        formatGooseRecipeList(),
        '',
        'Run: `/recipe start <id>` · advance with `/recipe next`',
      ]
        .filter(Boolean)
        .join('\n'),
      { display: 'system' },
    )
    return null
  }

  const [cmd, ...rest] = trimmed.split(/\s+/)
  const id = rest.join(' ').trim()

  if (cmd === 'status') {
    onDone(formatRecipeSessionStatus(cwd) ?? 'No active recipe session.', {
      display: 'system',
    })
    return null
  }

  if (cmd === 'stop' || cmd === 'clear') {
    clearRecipeSession(cwd)
    onDone('Recipe session cleared.', { display: 'system' })
    return null
  }

  if (cmd === 'next') {
    const result = advanceRecipeSession(cwd)
    if (result.kind === 'none') {
      onDone('No active recipe. Start with `/recipe start <id>`.', { display: 'system' })
      return null
    }
    if (result.kind === 'done') {
      onDone(`Recipe **${result.recipe.name}** complete.`, { display: 'system' })
      return null
    }
    const { step, recipe, index } = result
    const label = `Step ${index + 1}/${recipe.steps.length}: **${step.id}**`
    if (step.command) {
      onDone(`${label} — submitting \`${step.command}\`…`, {
        display: 'system',
        nextInput: step.command,
        submitNextInput: true,
      })
    } else {
      onDone(`${label} — ${step.instruction}`, { display: 'system' })
    }
    return null
  }

  if (cmd === 'start') {
    const recipe = getGooseRecipe(id)
    if (!recipe) {
      onDone(`Unknown recipe \`${id}\`.\n\n${formatGooseRecipeList()}`, {
        display: 'system',
      })
      return null
    }
    startRecipeSession(cwd, recipe.id)
    const first = recipe.steps[0]
    const banner = formatGooseRecipeRun(recipe)
    if (first?.command) {
      onDone(`${banner}\n\n---\n\n**Starting step 1** — submitting \`${first.command}\`…`, {
        display: 'system',
        nextInput: first.command,
        submitNextInput: true,
      })
    } else {
      onDone(banner, { display: 'system' })
    }
    return null
  }

  if (cmd === 'run') {
    const recipe = getGooseRecipe(id)
    if (!recipe) {
      onDone(`Unknown recipe \`${id}\`.\n\n${formatGooseRecipeList()}`, {
        display: 'system',
      })
      return null
    }
    onDone(formatGooseRecipeRun(recipe), { display: 'system' })
    return null
  }

  const direct = getGooseRecipe(trimmed)
  if (direct) {
    onDone(formatGooseRecipeRun(direct), { display: 'system' })
    return null
  }

  const session = getRecipeSession(cwd)
  onDone(
    [
      'Usage: `/recipe start <id>` · `/recipe next` · `/recipe status`',
      session ? `\nActive: ${formatRecipeSessionStatus(cwd)}` : '',
      '',
      formatGooseRecipeList(),
    ].join('\n'),
    { display: 'system' },
  )
  return null
}
