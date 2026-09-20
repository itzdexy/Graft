import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { existsSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { buildDefaultQuestions, parseSuperthinkArgs } from './core.js'
import { resolveSuperthinkGoal } from './goalResolve.js'
import { openUrl } from './openBrowser.js'
import {
  buildDesignMarkdown,
  buildSuperthinkBuildPrompt,
  buildSuperthinkClarifyWaitMessage,
  buildSuperthinkNeedClarifyMessage,
  buildSuperthinkResearchDoneMessage,
  formatSuperthinkHelp,
} from './prompts.js'
import { loadResearchBrief } from './researchStore.js'
import {
  deriveSessionPhase,
  getActiveSuperthinkGoal,
  loadApprovedPlan,
  recordSessionGoal,
  saveApprovedSession,
  setActiveSuperthinkGoal,
  markSuperthinkBuilding,
} from './sessionStore.js'
import {
  startQuestionnaireServer,
  startResultPreviewServer,
} from './server.js'
import { isSuperthinkEnabled, setSuperthinkEnabled } from './state.js'

export type SuperthinkRunResult =
  | { mode: 'display'; text: string }
  | { mode: 'query'; blocks: ContentBlockParam[] }
  | { mode: 'subagent'; phase: 'research'; goal: string }

function text(t: string): ContentBlockParam[] {
  return [{ type: 'text', text: t }]
}

function display(t: string): SuperthinkRunResult {
  return { mode: 'display', text: t }
}

function query(blocks: ContentBlockParam[]): SuperthinkRunResult {
  return { mode: 'query', blocks }
}

function researchSubagent(goal: string): SuperthinkRunResult {
  return { mode: 'subagent', phase: 'research', goal }
}

function superthinkToggleNote(cwd: string): string {
  if (isSuperthinkEnabled(cwd)) return ''
  return '\n\n_(Superthink **toggle is OFF** — `/superthink on` auto-routes plain goals; one-shot `/superthink <goal>` does not enable it.)_'
}

/** True when superthinker mode is toggled on for this project (for the REPL to consult). */
export function shouldSuperthink(cwd: string): boolean {
  return isSuperthinkEnabled(cwd)
}

async function runClarifyFlow(
  cwd: string,
  rawGoal: string,
): Promise<SuperthinkRunResult> {
  const goal = resolveSuperthinkGoal(cwd, rawGoal)
  if (!goal.trim()) {
    return display(
      'No active superthink goal. Start with `/superthink <goal>` or `/superthink continue <goal>`.',
    )
  }

  setActiveSuperthinkGoal(cwd, goal)
  recordSessionGoal(cwd, goal)

  const existing = loadApprovedPlan(cwd, goal)
  if (existing) {
    return query(
      text(
        buildSuperthinkBuildPrompt(goal, buildDefaultQuestions(goal), existing.answers, existing.plan),
      ),
    )
  }

  const research = loadResearchBrief(cwd, goal)
  const questions = buildDefaultQuestions(goal)
  let server
  try {
    server = await startQuestionnaireServer({ goal, questions, researchBrief: research })
  } catch (err) {
    return display(
      `Could not start the superthinker questionnaire server: ${(err as Error).message}.`,
    )
  }

  openUrl(server.url)
  process.stderr.write(
    `\n✲ Superthinker: brainstorm at ${server.url} (waiting for plan approval…)\n`,
  )

  // User-visible notice while we block on the browser flow.
  const waitNotice = buildSuperthinkClarifyWaitMessage(server.url, goal)

  try {
    const { answers, plan } = await server.waitForResult
    const design = buildDesignMarkdown(goal, questions, answers, plan, research)
    saveApprovedSession(cwd, goal, answers, plan, design)
    return query(text(buildSuperthinkBuildPrompt(goal, questions, answers, plan)))
  } catch (err) {
    server.close()
    const timedOut = (err as Error).message.toLowerCase().includes('timed out')
    return display(
      timedOut
        ? `${waitNotice}\n\n---\n\nQuestionnaire timed out. Run \`/superthink continue\` when ready.`
        : `${waitNotice}\n\n---\n\nQuestionnaire ended early (${(err as Error).message}). Run \`/superthink continue\` to retry.`,
    )
  }
}

async function runBuildFlow(cwd: string, rawGoal: string): Promise<SuperthinkRunResult> {
  const goal = resolveSuperthinkGoal(cwd, rawGoal)
  if (!goal.trim()) {
    return display('No active goal. Use `/superthink <goal>` first.')
  }
  setActiveSuperthinkGoal(cwd, goal)
  recordSessionGoal(cwd, goal)

  const approved = loadApprovedPlan(cwd, goal)
  if (approved) {
    markSuperthinkBuilding(cwd, goal)
    const questions = buildDefaultQuestions(goal)
    return query(
      text(
        buildSuperthinkBuildPrompt(goal, questions, approved.answers, approved.plan),
      ),
    )
  }

  if (!loadResearchBrief(cwd, goal)) {
    return researchSubagent(goal)
  }

  return display(buildSuperthinkNeedClarifyMessage(goal))
}

async function runGoalFlow(cwd: string, rawGoal: string): Promise<SuperthinkRunResult> {
  const goal = resolveSuperthinkGoal(cwd, rawGoal)
  if (!goal.trim()) return display('Usage: `/superthink <goal>`' + superthinkToggleNote(cwd))

  setActiveSuperthinkGoal(cwd, goal)
  recordSessionGoal(cwd, goal)
  const phase = deriveSessionPhase(cwd, goal)

  switch (phase) {
    case 'ready': {
      const approved = loadApprovedPlan(cwd, goal)!
      markSuperthinkBuilding(cwd, goal)
      const questions = buildDefaultQuestions(goal)
      return query(
        text(
          buildSuperthinkBuildPrompt(goal, questions, approved.answers, approved.plan),
        ),
      )
    }
    case 'clarify': {
      const clarifyResult = await runClarifyFlow(cwd, goal)
      if (clarifyResult.mode === 'query') {
        const notice = buildSuperthinkResearchDoneMessage(goal)
        const first = clarifyResult.blocks[0]
        if (first?.type === 'text') {
          return query(text(`${notice}\n\n${first.text}`))
        }
      }
      return clarifyResult
    }
    case 'research':
    default:
      return researchSubagent(goal)
  }
}

async function runResultPreview(cwd: string, pathArg: string): Promise<SuperthinkRunResult> {
  if (!pathArg.trim()) return display('Usage: `/superthink result <dir-or-file>`')
  const target = isAbsolute(pathArg) ? pathArg : join(cwd, pathArg)
  if (!existsSync(target)) return display(`Path not found: ${target}`)

  const root = statSync(target).isDirectory() ? target : dirname(target)
  let preview
  try {
    preview = await startResultPreviewServer({ root, title: basename(target) })
  } catch (err) {
    return display(`Could not start the preview server: ${(err as Error).message}.`)
  }
  openUrl(preview.url)
  const timer = setTimeout(() => preview.close(), 30 * 60 * 1000)
  timer.unref?.()
  return display(
    `◎ Result preview: ${preview.url} (serving \`${root}\`, ~30 min).`,
  )
}

/** Entry point for the `/superthink` command. */
export async function runSuperthink(
  cwd: string,
  args: string,
): Promise<SuperthinkRunResult> {
  const { command, goal } = parseSuperthinkArgs(args)
  switch (command) {
    case 'help':
      return display(formatSuperthinkHelp())
    case 'on':
      setSuperthinkEnabled(cwd, true)
      return display(
        '✲ Superthinker ON — goals follow Superpowers-style research → brainstorm → plan → build. Off: `/superthink off`.',
      )
    case 'off':
      setSuperthinkEnabled(cwd, false)
      return display('Superthinker mode is OFF.')
    case 'status': {
      const active = getActiveSuperthinkGoal(cwd)
      const phase = active ? deriveSessionPhase(cwd, active) : null
      const lines = [
        isSuperthinkEnabled(cwd)
          ? '✲ Superthinker mode: ON'
          : 'Superthinker mode: OFF',
      ]
      if (active) {
        lines.push(`Active goal: ${active}`)
        if (phase) lines.push(`Phase: ${phase}`)
      }
      return display(lines.join('\n'))
    }
    case 'result':
      return runResultPreview(cwd, goal)
    case 'continue':
      return runClarifyFlow(cwd, goal)
    case 'go':
      return runBuildFlow(cwd, goal)
    case 'run':
      return runGoalFlow(cwd, goal)
  }
}
