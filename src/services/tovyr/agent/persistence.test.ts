import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import {
  agentSessionPath,
  clearAgentSession,
  loadAgentSession,
  saveAgentSession,
} from './persistence.js'
import type { AgentSession } from './types.js'

function makeSession(cwd: string): AgentSession {
  return {
    id: 's1',
    cwd,
    goal: {
      id: 'g1',
      text: 'do thing',
      acceptanceCriteria: [],
      createdAt: Date.now(),
    },
    phase: 'observe',
    steps: [],
    currentStepIndex: 0,
    reflections: [],
    contextNotes: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    maxRetriesPerStep: 3,
  }
}

describe('agent session persistence', () => {
  test('round-trips a valid session', () => {
    const cwd = '/nonexistent-agent-valid'
    saveAgentSession(makeSession(cwd))
    const loaded = loadAgentSession(cwd)
    expect(loaded?.cwd).toBe(cwd)
    expect(Array.isArray(loaded?.steps)).toBe(true)
    clearAgentSession(cwd)
  })

  test('returns null for a corrupt or old-format session file', () => {
    const cwd = '/nonexistent-agent-corrupt'
    const path = agentSessionPath(cwd)
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    // Valid JSON, but NOT a usable session — would crash the loop on
    // session.steps if returned as-is.
    writeFileSync(path, JSON.stringify({ hello: 'world' }), 'utf8')
    expect(loadAgentSession(cwd)).toBeNull()
    clearAgentSession(cwd)
  })

  test('rejects malformed optional orchestration state', () => {
    const cwd = '/nonexistent-agent-bad-orchestration'
    const session = makeSession(cwd) as AgentSession & { orchestration: unknown }
    session.orchestration = { enabled: true, state: 'building' }
    const path = agentSessionPath(cwd)
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(path, JSON.stringify(session), 'utf8')
    expect(loadAgentSession(cwd)).toBeNull()
    clearAgentSession(cwd)
  })
})
