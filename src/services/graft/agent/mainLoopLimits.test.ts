import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import {
  GRAFT_DEFAULT_MAIN_MAX_TURNS,
  resolveMainLoopMaxTurns,
} from './mainLoopLimits.js'

describe('mainLoopLimits', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    saved.GRAFT_MAX_TURNS = process.env.GRAFT_MAX_TURNS
    saved.GRAFT_SRC = process.env.GRAFT_SRC
    process.env.GRAFT_SRC = '1'
  })

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  test('uses default when env unset', () => {
    delete process.env.GRAFT_MAX_TURNS
    expect(resolveMainLoopMaxTurns()).toBe(GRAFT_DEFAULT_MAIN_MAX_TURNS)
  })

  test('respects explicit override', () => {
    expect(resolveMainLoopMaxTurns(42)).toBe(42)
  })

  test('GRAFT_MAX_TURNS=0 disables limit', () => {
    process.env.GRAFT_MAX_TURNS = '0'
    expect(resolveMainLoopMaxTurns()).toBeUndefined()
  })

  test('parses GRAFT_MAX_TURNS from env', () => {
    process.env.GRAFT_MAX_TURNS = '75'
    expect(resolveMainLoopMaxTurns()).toBe(75)
  })
})
