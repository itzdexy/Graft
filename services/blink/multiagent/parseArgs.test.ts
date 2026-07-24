import { describe, expect, test } from 'bun:test'
import { formatCritiqueUsage, parseCritiqueArgs } from './parseArgs.js'
import { MAX_ROUNDS, MIN_ROUNDS } from './modes.js'

describe('parseCritiqueArgs', () => {
  test('defaults to writer pair and two rounds', () => {
    expect(parseCritiqueArgs('improve README intro')).toEqual({
      pair: 'writer',
      rounds: 2,
      task: 'improve README intro',
    })
  })

  test('parses coder pair and rounds=N', () => {
    expect(
      parseCritiqueArgs('coder rounds=4 add retry to API client'),
    ).toEqual({
      pair: 'coder',
      rounds: 4,
      task: 'add retry to API client',
    })
  })

  test('clamps rounds to configured bounds', () => {
    expect(parseCritiqueArgs(`rounds=${MAX_ROUNDS + 10} task`).rounds).toBe(
      MAX_ROUNDS,
    )
    expect(parseCritiqueArgs('rounds=0 task').rounds).toBe(MIN_ROUNDS)
  })

  test('pair token is case-insensitive', () => {
    expect(parseCritiqueArgs('WRITER polish docs').pair).toBe('writer')
  })

  test('formatCritiqueUsage documents pairs and examples', () => {
    const usage = formatCritiqueUsage()
    expect(usage).toContain('/critique')
    expect(usage).toContain('writer')
    expect(usage).toContain('coder')
    expect(usage).toContain('rounds=')
  })
})