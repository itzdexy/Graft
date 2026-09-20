import { describe, expect, test } from 'bun:test'
import {
  formatGraftConnectionFacts,
  shouldShowGraftContextAgentStatus,
} from './GraftContextRail.js'

describe('shouldShowGraftContextAgentStatus', () => {
  test('leaves the agents focus to the dedicated agent HUD', () => {
    expect(shouldShowGraftContextAgentStatus('agents')).toBe(false)
    expect(shouldShowGraftContextAgentStatus('none')).toBe(true)
    expect(shouldShowGraftContextAgentStatus('file')).toBe(true)
  })
})

describe('formatGraftConnectionFacts', () => {
  test('packs provider, model, and effort into one identity cluster', () => {
    expect(
      formatGraftConnectionFacts({
        provider: 'Meta',
        model: 'Muse Spark 1.3',
        effort: 'high',
        connection: 'ask',
      }),
    ).toEqual(['Meta · Muse Spark 1.3 · high', 'ask'])
  })
})
