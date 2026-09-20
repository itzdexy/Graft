import { describe, expect, test } from 'bun:test'
import { extractTasksFromLine } from '../../../comments/TaskTriggers.js'
import { parseSymbols } from '../../../intelligence/treeSitter.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  advanceBmadWorkflow,
  createBmadWorkflow,
  getBmadWorkflow,
  listBmadWorkflowIds,
} from '../../../workflows/bmad.js'
import { quickThinkChain } from '../../../mcp/sequentialThinking.js'
import { getOrCreatePromptCacheEntry, lookupPromptCache } from '../../../inference/promptCache.js'
import { getExpansionFeatureStatuses } from './index.js'

describe('expansion features', () => {
  test('comment task extraction', () => {
    const t = extractTasksFromLine('// GRAFT: add tests', 'a.ts', 1)
    expect(t?.kind).toBe('graft')
    expect(t?.text).toContain('add tests')
  })

  test('tree-sitter symbols', () => {
    const code = 'export function foo() {}\nexport class Bar {}'
    const syms = parseSymbols(code, 'typescript')
    expect(syms.some(s => s.name === 'foo')).toBe(true)
    expect(syms.some(s => s.name === 'Bar')).toBe(true)
  })

  test('BMAD workflow advances', () => {
    const w = createBmadWorkflow('ship feature X')
    expect(w.currentPhase).toBe('breakdown')
    const next = advanceBmadWorkflow(w.id, 'done')
    expect(next?.currentPhase).toBe('model')
  })

  test('BMAD workflow persists to .graft/bmad', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'graft-bmad-'))
    try {
      const w = createBmadWorkflow('persist goal', cwd)
      advanceBmadWorkflow(w.id, 'step output', cwd)
      const reloaded = getBmadWorkflow(w.id, cwd)
      expect(reloaded?.steps[0]?.status).toBe('done')
      expect(reloaded?.steps[0]?.output).toBe('step output')
      expect(listBmadWorkflowIds(cwd)).toContain(w.id)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  test('sequential thinking chain', () => {
    const out = quickThinkChain('fix bug')
    expect(out).toContain('Sequential thinking')
    expect(out).toContain('Conclusion')
  })

  test('prompt cache hit', () => {
    getOrCreatePromptCacheEntry('system prompt v1')
    expect(lookupPromptCache('system prompt v1')?.hits).toBeGreaterThan(0)
  })

  test('feature registry includes all ids', () => {
    const ids = getExpansionFeatureStatuses().map(f => f.id)
    expect(ids).toContain('adversary-agent')
    expect(ids).toContain('memory-graph')
    expect(ids).not.toContain('chrome-extension')
    expect(ids.length).toBeGreaterThanOrEqual(23)
  })
})
