import { describe, expect, test } from 'bun:test'
import { parseGeminiAtMentions } from './adapters/gemini-cli.js'
import { parseWarpCommandBlocks } from './adapters/warp.js'
import { parseInterpretArgs } from './adapters/openinterpreter.js'
import {
  ECOSYSTEM_UPSTREAMS,
  formatEcosystemCatalog,
  listEcosystemFeatureCount,
} from './catalog.js'
import { getGooseRecipe, GOOSE_RECIPES } from './recipes/gooseRecipes.js'
import { listEcosystemSkillIds } from './skills.js'
import { savePlanVersion, listPlanVersions } from './sandbox/planVersions.js'
import {
  getActiveExperimentFork,
  listExperimentForks,
  saveExperimentFork,
  suggestExperimentGitBranch,
} from './opencode/forkStore.js'
import { isCrushModeEnabled, setCrushModeEnabled } from './crush/state.js'
import { syncContinueRules } from './continue/syncRules.js'
import {
  advanceRecipeSession,
  getRecipeSession,
  startRecipeSession,
} from './recipes/recipeSession.js'
import { buildWorktreePlan } from './openhands/worktree.js'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('ecosystem catalog', () => {
  test('lists 14 upstream agents', () => {
    expect(ECOSYSTEM_UPSTREAMS.length).toBe(14)
    expect(listEcosystemFeatureCount()).toBeGreaterThan(20)
  })

  test('formatEcosystemCatalog mentions key commands', () => {
    const text = formatEcosystemCatalog()
    expect(text).toContain('Aider')
    expect(text).toContain('/recipe')
    expect(text).toContain('/sandbox-diff')
  })

  test('ecosystem skills match upstream count', () => {
    // Blurb skills were removed: they cost skill-list context every turn
    // and the model wrote one of them into the user's repo as ecosystem.md.
    expect(listEcosystemSkillIds()).toEqual([])
  })
})

describe('goose recipes', () => {
  test('ship-feature recipe exists', () => {
    const r = getGooseRecipe('ship-feature')
    expect(r?.steps.length).toBeGreaterThan(2)
  })

  test('has expanded recipe set', () => {
    expect(GOOSE_RECIPES.length).toBeGreaterThanOrEqual(15)
  })

  test('all recipes have ids', () => {
    for (const r of GOOSE_RECIPES) {
      expect(r.id.length).toBeGreaterThan(0)
    }
  })
})

describe('gemini-cli adapter', () => {
  test('parses @file mentions', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-eco-'))
    const f = join(cwd, 'foo.ts')
    writeFileSync(f, 'export const x = 1')
    const paths = parseGeminiAtMentions('read @foo.ts please', cwd)
    expect(paths.some(p => p.endsWith('foo.ts'))).toBe(true)
  })
})

describe('warp adapter', () => {
  test('splits command blocks on blank lines', () => {
    const blocks = parseWarpCommandBlocks('echo one\necho two\n\necho three')
    expect(blocks.length).toBe(2)
  })
})

describe('openinterpreter adapter', () => {
  test('parses python shorthand', () => {
    const p = parseInterpretArgs('python print(1)')
    expect(p?.lang).toBe('python')
    expect(p?.code).toContain('print')
  })
})

describe('plan versions', () => {
  test('save and list plan branches', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-plan-'))
    savePlanVersion(cwd, 'my feature', '# plan body', 'summary')
    expect(listPlanVersions(cwd, 'my feature').length).toBe(1)
  })
})

describe('exec policy', () => {
  test('generates execpolicy markdown', async () => {
    const { generateExecPolicyMd } = await import('./codex/execPolicy.js')
    const md = generateExecPolicyMd('/tmp/myproject')
    expect(md).toContain('execpolicy')
    expect(md).toContain('AGENTS.md')
    expect(md).toContain('/mode bypass')
  })

  test('execPolicyPath joins cwd', async () => {
    const { execPolicyPath } = await import('./codex/execPolicy.js')
    expect(execPolicyPath('/foo/bar')).toContain('execpolicy.md')
    expect(execPolicyPath('/foo/bar')).toContain('bar')
  })
})

describe('opencode fork store', () => {
  test('saves and lists experiment forks', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-fork-'))
    const meta = saveExperimentFork(cwd, 'try auth refactor')
    expect(meta.forkId.length).toBeGreaterThan(8)
    expect(listExperimentForks(cwd).length).toBe(1)
    expect(getActiveExperimentFork(cwd)?.label).toBe('try auth refactor')
    expect(suggestExperimentGitBranch(meta)).toContain('experiment/')
  })
})

describe('crush mode', () => {
  test('toggles project crush state', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-crush-'))
    expect(isCrushModeEnabled(cwd)).toBe(false)
    setCrushModeEnabled(cwd, true)
    expect(isCrushModeEnabled(cwd)).toBe(true)
    setCrushModeEnabled(cwd, false)
    expect(isCrushModeEnabled(cwd)).toBe(false)
  })
})

describe('continue rules sync', () => {
  test('writes default rules when no AGENTS.md', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-continue-'))
    const result = syncContinueRules(cwd)
    expect(result.path).toContain('tovyr.md')
    expect(result.created).toBe(true)
  })
})

describe('warp run blocks', () => {
  test('detects destructive commands', async () => {
    const { planWarpBlocks } = await import('./warp/runBlocks.js')
    const plan = planWarpBlocks('echo ok\n\nrm -rf /tmp/foo')
    expect(plan.blocks.length).toBe(2)
    expect(plan.destructive).toBe(true)
  })
})

describe('recipe session', () => {
  test('tracks and advances steps', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-recipe-'))
    startRecipeSession(cwd, 'ship-feature')
    expect(getRecipeSession(cwd)?.recipeId).toBe('ship-feature')
    const first = advanceRecipeSession(cwd)
    expect(first.kind).toBe('step')
  })
})

describe('ecosystem status', () => {
  test('formats status markdown', async () => {
    const { formatEcosystemStatus } = await import('./status.js')
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-status-'))
    const text = formatEcosystemStatus(cwd)
    expect(text).toContain('Superthink')
    expect(text).toContain('Crush')
  })
})

describe('ecosystem coverage', () => {
  test('all 14 upstreams pass coverage audit', async () => {
    const { auditUpstreamCoverage, listUpstreamCoverageRows } = await import(
      './coverage.js'
    )
    const audit = auditUpstreamCoverage()
    expect(audit.ok, audit.gaps.join('\n')).toBe(true)
    expect(listUpstreamCoverageRows().length).toBe(14)
  })

  test('each upstream has help text', async () => {
    const { getUpstreamHelp } = await import('./upstreamHelp.js')
    const { ECOSYSTEM_UPSTREAMS } = await import('./catalog.js')
    for (const u of ECOSYSTEM_UPSTREAMS) {
      expect(getUpstreamHelp(u.id).length).toBeGreaterThan(50)
    }
  })

  test('formatUpstreamCoverage lists every repo', async () => {
    const { formatUpstreamCoverage } = await import('./coverage.js')
    const text = formatUpstreamCoverage()
    expect(text).toContain('Tovyr')
    expect(text).toContain('Open Interpreter')
    expect(text).toContain('/codex')
  })
})

describe('openhands worktree', () => {
  test('builds worktree plan', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-wt-'))
    const plan = buildWorktreePlan(cwd, 'issue-99')
    expect(plan.branch).toContain('openhands/')
    expect(plan.commands[0]).toContain('git worktree add')
  })
})
