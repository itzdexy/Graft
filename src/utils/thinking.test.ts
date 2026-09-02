import { expect, test, describe } from 'bun:test'
import { thinkingAllowedWithToolChoice } from './thinking.js'

describe('thinkingAllowedWithToolChoice', () => {
  test('allows thinking with no tool_choice', () => {
    expect(thinkingAllowedWithToolChoice(undefined)).toBe(true)
  })

  test('allows thinking with auto tool_choice', () => {
    expect(thinkingAllowedWithToolChoice({ type: 'auto' })).toBe(true)
  })

  test('blocks thinking when a specific tool is forced', () => {
    expect(
      thinkingAllowedWithToolChoice({ type: 'tool', name: 'Bash' } as {
        type: string
      }),
    ).toBe(false)
  })

  test('blocks thinking when any tool is forced', () => {
    expect(thinkingAllowedWithToolChoice({ type: 'any' })).toBe(false)
  })
})
