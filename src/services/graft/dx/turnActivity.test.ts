import { describe, expect, test } from 'bun:test'
import {
  completeTurnActivity,
  reduceTurnActivity,
  type GraftTurnActivity,
} from './turnActivity.js'

describe('turn activity', () => {
  test('promotes the real current phase while retaining completed evidence', () => {
    const thinking = reduceTurnActivity(null, {
      type: 'thinking',
      label: 'Inspecting the model path',
      at: 1,
    })
    const searching = reduceTurnActivity(thinking, {
      type: 'search_started',
      query: 'NVIDIA NIM model health',
      at: 2,
    })
    const tooling = reduceTurnActivity(searching, {
      type: 'tool_started',
      toolName: 'Bash',
      summary: 'bun test',
      at: 3,
    })

    expect(thinking?.kind).toBe('thinking')
    expect(searching?.kind).toBe('searching')
    expect(tooling?.kind).toBe('running_tool')
    expect(tooling?.evidence.map(item => item.label)).toEqual([
      'Inspecting the model path',
      'Search · NVIDIA NIM model health',
    ])
  })

  test('permission wait replaces—not duplicates—the active tool row', () => {
    const tooling: GraftTurnActivity = {
      kind: 'running_tool',
      status: 'active',
      label: 'Bash · bun test',
      startedAt: 1,
      updatedAt: 1,
      evidence: [],
    }

    const waiting = reduceTurnActivity(tooling, {
      type: 'permission_requested',
      summary: 'Run bun test',
      at: 2,
    })

    expect(waiting?.kind).toBe('waiting_for_permission')
    expect(waiting?.label).toBe('Approval needed · Run bun test')
    expect(waiting?.evidence).toHaveLength(1)
  })

  test('collapses a finished turn to static evidence', () => {
    const activity = reduceTurnActivity(null, {
      type: 'verifying',
      label: 'Running focused tests',
      at: 10,
    })
    const completed = completeTurnActivity(activity!, 20)

    expect(completed).toMatchObject({
      kind: 'complete',
      status: 'complete',
      label: 'Complete',
    })
    expect(completed.evidence.at(-1)).toMatchObject({
      label: 'Running focused tests',
      state: 'done',
    })
  })
})
