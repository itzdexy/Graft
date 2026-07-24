import { describe, expect, test } from 'bun:test'
import {
  BLINK_EXAMPLE_PROMPTS,
  resolveBlinkExamplePromptInput,
} from './blinkExamplePrompts.js'

describe('blinkExamplePrompts', () => {
  test('resolveBlinkExamplePromptInput keeps plain hints', () => {
    const hint = BLINK_EXAMPLE_PROMPTS[0]!.hint
    expect(resolveBlinkExamplePromptInput(hint)).toBe(hint)
  })

  test('resolveBlinkExamplePromptInput unwraps label - hint paste', () => {
    const { label, hint } = BLINK_EXAMPLE_PROMPTS[0]!
    expect(resolveBlinkExamplePromptInput(`${label} - ${hint}`)).toBe(hint)
  })

  test('resolveBlinkExamplePromptInput unwraps label em dash hint paste', () => {
    const { label, hint } = BLINK_EXAMPLE_PROMPTS[0]!
    expect(resolveBlinkExamplePromptInput(`${label} — ${hint}`)).toBe(hint)
  })

  test('resolveBlinkExamplePromptInput unwraps mojibake separator paste', () => {
    const { label, hint } = BLINK_EXAMPLE_PROMPTS[0]!
    expect(
      resolveBlinkExamplePromptInput(`${label} ┌Çö ${hint}`),
    ).toBe(hint)
  })

  test('resolveBlinkExamplePromptInput leaves unrelated text alone', () => {
    const text = 'Fix the login form validation'
    expect(resolveBlinkExamplePromptInput(text)).toBe(text)
  })
})
