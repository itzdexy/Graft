import { describe, expect, test } from 'bun:test'
import {
  formatUnknownSkillCorrection,
  isCasualConversationPrompt,
  isLocalClockPrompt,
  isRecoverableUnknownSkillResult,
  requiresLiveWebTool,
} from './modelCompatibility.js'

describe('model compatibility recovery', () => {
  test('recognizes greeting-only turns that must not expose Skill', () => {
    expect(isCasualConversationPrompt('hi')).toBe(true)
    expect(isCasualConversationPrompt('Good morning!')).toBe(true)
    expect(isCasualConversationPrompt('hi, fix the API')).toBe(false)
  })

  test('recognizes string and block unknown-skill results', () => {
    expect(isRecoverableUnknownSkillResult('Unknown skill: greeting')).toBe(true)
    expect(
      isRecoverableUnknownSkillResult([
        { type: 'text', text: 'Unknown skill: greeting' },
      ]),
    ).toBe(true)
    expect(isRecoverableUnknownSkillResult('Permission denied')).toBe(false)
  })

  test('routes live facts without matching static questions', () => {
    expect(requiresLiveWebTool('what time is it')).toBe(false)
    expect(isLocalClockPrompt('what time is it')).toBe(true)
    expect(isLocalClockPrompt("what's today's date?")).toBe(true)
    expect(requiresLiveWebTool('current weather in Boston')).toBe(true)
    expect(requiresLiveWebTool('what is the current Bitcoin price?')).toBe(true)
    expect(requiresLiveWebTool('explain time complexity')).toBe(false)
    expect(requiresLiveWebTool('show the current directory')).toBe(false)
  })

  test('correction tells weaker models to continue without inventing tools', () => {
    const correction = formatUnknownSkillCorrection('greeting', ['pdf', 'review'])
    expect(correction).toContain('recoverable')
    expect(correction).toContain('Answer the user directly')
    expect(correction).toContain('pdf, review')
  })
})
