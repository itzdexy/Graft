import { describe, expect, test } from 'bun:test'
import {
  listMemoryEntries,
  loadProjectMemory,
  mergeMemoryUpdatesFromText,
  rememberProjectFact,
  searchProjectMemory,
  type TovyrProjectMemory,
} from './memory.js'

const emptyMemory = (): TovyrProjectMemory => ({
  projectName: 'test',
  goals: [],
  architecture: [],
  decisions: [],
  roadmap: [],
  codingStandards: [],
  updatedAt: Date.now(),
})

describe('project memory search', () => {
  test('listMemoryEntries flattens categories', () => {
    const m = emptyMemory()
    m.goals.push('Ship v2')
    m.decisions.push('Use Postgres')
    const entries = listMemoryEntries(m)
    expect(entries).toHaveLength(2)
  })

  test('searchProjectMemory ranks exact matches higher', () => {
    const m = emptyMemory()
    m.architecture.push('Event-driven workers')
    m.architecture.push('Monolith API')
    const hits = searchProjectMemory(m, 'event-driven')
    expect(hits[0]?.text.toLowerCase()).toContain('event')
  })

  test('rememberProjectFact dedupes', () => {
    const cwd = '/nonexistent-test-path'
    rememberProjectFact(cwd, 'goals', 'Same goal')
    const m = rememberProjectFact(cwd, 'goals', 'Same goal')
    expect(m.goals.filter(g => g === 'Same goal')).toHaveLength(1)
  })

  test('freshly loaded memories do not share array references', () => {
    // Two missing-file loads (no writes happen) must own independent arrays,
    // otherwise mutating one leaks into the other and into future loads.
    const a = loadProjectMemory('/nonexistent-buddy-share-a')
    const b = loadProjectMemory('/nonexistent-buddy-share-b')
    a.goals.push('local only')
    expect(b.goals).toHaveLength(0)
    const aAgain = loadProjectMemory('/nonexistent-buddy-share-a')
    expect(aAgain.goals).toHaveLength(0)
  })

  test('mergeMemoryUpdatesFromText stops at the next heading', () => {
    const cwd = `/nonexistent-buddy-merge-${Date.now()}`
    const text = [
      'Preamble text.',
      '## Memory updates',
      '- goals: ship the buddy fix',
      '## Next steps',
      '- decisions: this lives under another heading and must be ignored',
    ].join('\n')
    const res = mergeMemoryUpdatesFromText(cwd, text)
    // Only the single in-section bullet should be merged.
    expect(res.count).toBe(1)
  })
})
