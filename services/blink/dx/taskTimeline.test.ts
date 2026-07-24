import { describe, expect, test } from 'bun:test'
import type { AgentSession } from '../agent/types.js'
import { buildTaskTimeline, formatTimelineMarkdown } from './taskTimeline.js'

function mockSession(): AgentSession {
  return {
    id: 's1',
    cwd: '/p',
    goal: {
      id: 'g',
      text: 'Ship feature',
      acceptanceCriteria: [],
      createdAt: 1000,
    },
    phase: 'verify',
    steps: [
      {
        id: '1',
        title: 'Plan',
        description: '',
        status: 'done',
        attempts: 1,
        completedAt: 1100,
      },
    ],
    currentStepIndex: 0,
    reflections: ['Tests were flaky - retry with narrower scope'],
    contextNotes: [],
    startedAt: 1000,
    updatedAt: 1500,
    maxRetriesPerStep: 3,
    autoFix: true,
    autoFixRound: 1,
    maxAutoFixRounds: 3,
  }
}

describe('buildTaskTimeline', () => {
  test('includes session, steps, reflections, and tools', () => {
    const events = buildTaskTimeline(mockSession(), [
      {
        toolName: 'Bash',
        summary: 'npm test',
        ok: false,
        at: 1400,
      },
    ])
    const kinds = events.map(e => e.kind)
    expect(kinds).toContain('session')
    expect(kinds).toContain('step')
    expect(kinds).toContain('reflection')
    expect(kinds).toContain('verify')
    expect(kinds).toContain('tool')
    expect(kinds).toContain('phase')
    expect(events[0]!.at).toBeLessThanOrEqual(events[events.length - 1]!.at)
  })
})

describe('formatTimelineMarkdown', () => {
  test('renders markdown list', () => {
    const md = formatTimelineMarkdown([
      { at: 1000, kind: 'session', label: 'Start', detail: 'goal' },
    ])
    expect(md).toContain('# Agent timeline')
    expect(md).toContain('**session**')
  })
})
