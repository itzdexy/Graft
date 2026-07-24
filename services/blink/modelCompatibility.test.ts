import { describe, expect, test } from 'bun:test'
import {
  formatUnknownSkillCorrection,
  isRecoverableUnknownSkillResult,
} from './modelCompatibility.js'

describe('model compatibility recovery', () => {
  test('recognizes string and block unknown-skill results', () => {
    expect(isRecoverableUnknownSkillResult('Unknown skill: greeting')).toBe(true)
    expect(
      isRecoverableUnknownSkillResult([
        { type: 'text', text: 'Unknown skill: greeting' },
      ]),
    ).toBe(true)
    expect(isRecoverableUnknownSkillResult('Permission denied')).toBe(false)
  })

  test('correction tells weaker models to continue without inventing tools', () => {
    const correction = formatUnknownSkillCorrection('greeting', ['pdf', 'review'])
    expect(correction).toContain('recoverable')
    expect(correction).toContain('Answer the user directly')
    expect(correction).toContain('pdf, review')
  })
})
