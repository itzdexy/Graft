import { describe, expect, test } from 'bun:test'
import { processTextPrompt } from './processTextPrompt.js'

describe('Graft text prompt routing', () => {
  for (const prompt of ['hi', 'hello', 'how ru']) {
    test(`routes "${prompt}" through the selected provider`, () => {
      const result = processTextPrompt(prompt, [], [], [])

      expect(result.shouldQuery).toBe(true)
      expect(result.resultText).toBeUndefined()
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0]?.type).toBe('user')
    })
  }
})
