import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { LocalCommandCall } from '../../types/command.js'
import {
  buildContinueConfigFragment,
  execPolicyPath,
  formatEcosystemCatalog,
  formatEcosystemStatus,
  formatPlanVersionList,
  formatRampageSkillInvocation,
  formatUpstreamCoverage,
  generateExecPolicyMd,
  getGptEngineerPreprompt,
  GPT_ENGINEER_TEMPLATES,
  listGptEngineerTemplates,
  PLANDEX_WORKFLOW_REMINDER,
  resolveUpstreamHelpArg,
  savePlanVersion,
  syncContinueRules,
  writeContinueConfigFragment,
} from '../../services/blink/ecosystem/index.js'
import { getCwd } from '../../utils/cwd.js'

function readBlinkPlan(cwd: string): string | null {
  const planPath = join(cwd, 'blinkplan.md')
  if (!existsSync(planPath)) return null
  try {
    return readFileSync(planPath, 'utf8')
  } catch {
    return null
  }
}

export const call: LocalCommandCall = async (args) => {
  const raw = args.trim()
  const parts = raw.split(/\s+/)
  const sub = parts[0]?.toLowerCase() ?? 'list'

  if (!sub || sub === 'list' || sub === 'help') {
    return { type: 'text', value: formatEcosystemCatalog() }
  }

  if (sub === 'compact') {
    return { type: 'text', value: formatEcosystemCatalog(true) }
  }

  if (sub === 'status') {
    return { type: 'text', value: formatEcosystemStatus(getCwd()) }
  }

  if (sub === 'coverage') {
    return { type: 'text', value: formatUpstreamCoverage() }
  }

  const upstreamHelp = resolveUpstreamHelpArg(sub)
  if (upstreamHelp) {
    return { type: 'text', value: upstreamHelp }
  }

  if (sub === 'rampage') {
    return { type: 'text', value: formatRampageSkillInvocation() }
  }

  if (sub === 'plandex') {
    return { type: 'text', value: PLANDEX_WORKFLOW_REMINDER }
  }

  if (sub === 'template') {
    const id = parts[1] as keyof typeof GPT_ENGINEER_TEMPLATES | undefined
    if (!id || !(id in GPT_ENGINEER_TEMPLATES)) {
      return {
        type: 'text',
        value: `Usage: /ecosystem template <id>\n\n${listGptEngineerTemplates()}`,
      }
    }
    return {
      type: 'text',
      value: `# gpt-engineer template: ${id}\n\n${getGptEngineerPreprompt(id)}`,
    }
  }

  if (sub === 'config' && parts[1] === 'continue') {
    if (parts[2] === 'rules' || parts[2] === 'sync') {
      const cwd = getCwd()
      const result = syncContinueRules(cwd)
      return {
        type: 'text',
        value: `Synced Continue rules to \`${result.path}\` (source: ${result.source}).`,
      }
    }
    if (parts[2] === 'write' || parts[2] === 'install') {
      const cwd = getCwd()
      const { path, created } = writeContinueConfigFragment(cwd)
      return {
        type: 'text',
        value: created
          ? `Wrote Continue fragment to \`${path}\`.`
          : `\`${path}\` already exists — not overwritten.`,
      }
    }
    const name = basename(getCwd())
    return {
      type: 'text',
      value: buildContinueConfigFragment(name),
    }
  }

  if (sub === 'execpolicy') {
    const cwd = getCwd()
    if (parts[1] === 'write' || parts[1] === 'init') {
      const path = execPolicyPath(cwd)
      if (existsSync(path) && parts[2] !== 'force') {
        return {
          type: 'text',
          value: `\`${path}\` already exists. Use \`/ecosystem execpolicy write force\` to overwrite.`,
        }
      }
      writeFileSync(path, generateExecPolicyMd(cwd) + '\n', 'utf8')
      return { type: 'text', value: `Wrote Codex-style \`${path}\`.` }
    }
    return { type: 'text', value: generateExecPolicyMd(cwd) }
  }

  if (sub === 'plan') {
    const planCmd = parts[1]?.toLowerCase()
    const goal = parts.slice(2).join(' ').trim() || 'active goal'
    const cwd = getCwd()

    if (planCmd === 'list') {
      return { type: 'text', value: formatPlanVersionList(cwd, goal) }
    }

    if (planCmd === 'save') {
      const body = readBlinkPlan(cwd)
      if (!body?.trim()) {
        return {
          type: 'text',
          value: 'No `blinkplan.md` found. Run `/plan` first, then `/ecosystem plan save <goal>`.',
        }
      }
      const saved = savePlanVersion(cwd, goal, body)
      return {
        type: 'text',
        value: `Saved plan version \`${saved.id}\` for goal: ${goal}\n\n${formatPlanVersionList(cwd, goal)}`,
      }
    }

    return {
      type: 'text',
      value: [
        'Plandex-style plan branches under `.blink/ecosystem/plans/`',
        '',
        '- `/ecosystem plan save <goal>` — snapshot blinkplan.md',
        '- `/ecosystem plan list <goal>` — list versions',
      ].join('\n'),
    }
  }

  return {
    type: 'text',
    value:
      `Unknown subcommand \`${sub}\`. Try: list · status · coverage · rampage · template · plan · execpolicy · config continue rules · plandex · <upstream-id>`,
  }
}
