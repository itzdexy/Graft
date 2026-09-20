import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getGooseRecipe, type GooseRecipe, type GooseRecipeStep } from './gooseRecipes.js'

const SESSION_FILE = '.graft/ecosystem/recipe-session.json'

export type RecipeSession = {
  recipeId: string
  stepIndex: number
  startedAt: string
}

function sessionPath(cwd: string): string {
  return join(cwd, SESSION_FILE)
}

export function startRecipeSession(cwd: string, recipeId: string): RecipeSession {
  const session: RecipeSession = {
    recipeId,
    stepIndex: 1,
    startedAt: new Date().toISOString(),
  }
  const dir = join(cwd, '.graft/ecosystem')
  mkdirSync(dir, { recursive: true })
  writeFileSync(sessionPath(cwd), JSON.stringify(session, null, 2), 'utf8')
  return session
}

export function getRecipeSession(cwd: string): RecipeSession | null {
  const path = sessionPath(cwd)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as RecipeSession
  } catch {
    return null
  }
}

export function clearRecipeSession(cwd: string): void {
  const path = sessionPath(cwd)
  if (existsSync(path)) unlinkSync(path)
}

export type RecipeAdvanceResult =
  | { kind: 'done'; recipe: GooseRecipe }
  | { kind: 'step'; recipe: GooseRecipe; step: GooseRecipeStep; index: number }
  | { kind: 'none' }

export function advanceRecipeSession(cwd: string): RecipeAdvanceResult {
  const session = getRecipeSession(cwd)
  if (!session) return { kind: 'none' }
  const recipe = getGooseRecipe(session.recipeId)
  if (!recipe) {
    clearRecipeSession(cwd)
    return { kind: 'none' }
  }
  const step = recipe.steps[session.stepIndex]
  if (!step) {
    clearRecipeSession(cwd)
    return { kind: 'done', recipe }
  }
  const index = session.stepIndex
  session.stepIndex++
  writeFileSync(sessionPath(cwd), JSON.stringify(session, null, 2), 'utf8')
  if (session.stepIndex >= recipe.steps.length) {
    clearRecipeSession(cwd)
  }
  return { kind: 'step', recipe, step, index }
}

export function formatRecipeSessionStatus(cwd: string): string | null {
  const session = getRecipeSession(cwd)
  if (!session) return null
  const recipe = getGooseRecipe(session.recipeId)
  if (!recipe) return null
  const next = recipe.steps[session.stepIndex]
  return [
    `Recipe **${recipe.name}** (\`${recipe.id}\`)`,
    `Progress: step ${session.stepIndex + 1}/${recipe.steps.length}`,
    next ? `Next: \`${next.command ?? next.instruction}\`` : 'Complete — run `/recipe next` to confirm.',
  ].join(' · ')
}
