import { describe, expect, test } from 'bun:test'
import { shouldShowTovyrContextAgentStatus } from './TovyrContextRail.js'

describe('shouldShowTovyrContextAgentStatus', () => {
  test('leaves the agents focus to the dedicated agent HUD', () => {
    expect(shouldShowTovyrContextAgentStatus('agents')).toBe(false)
    expect(shouldShowTovyrContextAgentStatus('none')).toBe(true)
    expect(shouldShowTovyrContextAgentStatus('file')).toBe(true)
  })
})
