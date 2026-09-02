import { describe, expect, test } from 'bun:test'
import { buildCoordinatorAgentPrompt } from '../agent/coordinatorAgent.js'
import { createSession } from '../agent/GoalTracker.js'
import { getPlaywrightMcpHint } from '../browser/playwright.js'
import { formatDevOpsCatalog } from '../devops/catalog.js'
import { describeMemoryLayers } from '../memory/layers.js'
import { formatVectorMemoryStatus, semanticMemorySearch } from '../memory/vector.js'
import { formatMcpBundleCatalog, getMcpBundle } from '../marketplace/bundles.js'
import { formatPerformanceHints, shouldLazyRepoIndex } from '../performance/policy.js'
import {
  isProjectRepoIndexEnabled,
  projectRepoIndexPath,
} from '../repo/projectCache.js'
import { countPhasesByStatus, formatRoadmapStatus, ROADMAP_PHASES } from './phases.js'
import { suggestModelForTask, profileForGoal } from '../routing/modelRouter.js'
import { formatToolPoliciesHelp, resolveToolPermission } from '../tools/policies.js'
import { recordCommandHistory, searchCommandHistory } from '../terminal/commandHistory.js'
import { formatVoiceStatus } from '../voice/index.js'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('roadmap phases', () => {
  test('points to public GitHub issues', () => {
    expect(ROADMAP_PHASES.length).toBe(0)
    const counts = countPhasesByStatus()
    expect(counts.done + counts.partial + counts.planned).toBe(0)
    expect(formatRoadmapStatus()).toContain('github.com/itzdexy/Tovyr/issues')
  })
})

describe('phase 2/11 browser', () => {
  test('playwright hint documents MCP setup', () => {
    expect(getPlaywrightMcpHint()).toContain('playwright')
  })
})

describe('phase 3 project cache', () => {
  test('project cache path under .tovyr', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-pcache-'))
    expect(projectRepoIndexPath(cwd)).toContain('.tovyr')
    expect(isProjectRepoIndexEnabled()).toBe(process.env.TOVYR_REPO_INDEX_LOCAL === '1')
  })
})

describe('phase 4 memory layers', () => {
  test('describes four layers', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-mem-'))
    expect(describeMemoryLayers(cwd).length).toBe(4)
  })

  test('semantic search returns array', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-sem-'))
    expect(semanticMemorySearch(cwd, 'auth', 5)).toEqual([])
    expect(formatVectorMemoryStatus()).toContain('Vector memory')
  })
})

describe('phase 5 coordinator agent', () => {
  test('builds agent prompt with policy', () => {
    const session = createSession('/tmp', 'ship feature', [
      {
        id: 'step-1',
        title: 'Implement',
        status: 'pending',
        specialist: 'coder',
      },
    ])
    const text = buildCoordinatorAgentPrompt(session)
    expect(text).toContain('Conflict resolution policy')
    expect(text).toContain('ship feature')
  })
})

describe('phase 6 tool policies', () => {
  test('help documents policy file', () => {
    expect(formatToolPoliciesHelp()).toContain('tool-policies.json')
    expect(resolveToolPermission('UnknownToolXyz')).toBeNull()
  })
})

describe('phase 9 performance', () => {
  test('lazy index default on', () => {
    expect(shouldLazyRepoIndex()).toBe(process.env.TOVYR_LAZY_REPO_INDEX !== '0')
    expect(formatPerformanceHints()).toContain('TOVYR_REPO_INDEX_LOCAL')
  })
})

describe('phase 10 command history', () => {
  test('records and searches history', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'tovyr-hist-'))
    recordCommandHistory('build auth module', cwd)
    const hits = searchCommandHistory('auth', cwd)
    expect(hits.some(h => h.text.includes('auth'))).toBe(true)
  })
})

describe('phase 14 devops', () => {
  test('catalog includes docker and gaming', () => {
    const text = formatDevOpsCatalog()
    expect(text).toContain('Docker')
    expect(text).toContain('Gaming')
  })
})

describe('phase 15 marketplace', () => {
  test('bundles include github', () => {
    expect(getMcpBundle('github')?.servers).toContain('github')
    expect(formatMcpBundleCatalog()).toContain('MCP bundles')
  })
})

describe('phase 16 routing', () => {
  test('profiles cheap goals', () => {
    expect(profileForGoal('save tokens please')).toBe('cheap')
    const pick = suggestModelForTask('build api', [
      'claude-3-5-haiku',
      'claude-3-5-sonnet',
    ])
    expect(pick).toBeTruthy()
  })
})

describe('phase 13 voice', () => {
  test('status mentions voice flag', () => {
    expect(formatVoiceStatus()).toContain('Voice')
  })
})
