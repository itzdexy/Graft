import { describe, expect, test } from 'bun:test'
import { modelSupportsAutoMode } from './betas.js'

describe('Graft frontier model auto mode', () => {
  test('supports current Fable and Opus agentic model families', () => {
    expect(modelSupportsAutoMode('claude-fable-5')).toBe(true)
    expect(modelSupportsAutoMode('claude-opus-5')).toBe(true)
    expect(modelSupportsAutoMode('claude-opus-4-8')).toBe(true)
  })
})
