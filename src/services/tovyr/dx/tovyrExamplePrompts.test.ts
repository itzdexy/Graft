import { describe, expect, test } from 'bun:test'
import {
  TOVYR_EXAMPLE_PROMPTS,
  resolveTovyrExamplePromptInput,
} from './tovyrExamplePrompts.js'

describe('tovyrExamplePrompts', () => {
  test('resolveTovyrExamplePromptInput keeps plain hints', () => {
    const hint = TOVYR_EXAMPLE_PROMPTS[0]!.hint
    expect(resolveTovyrExamplePromptInput(hint)).toBe(hint)
  })

  test('resolveTovyrExamplePromptInput unwraps label - hint paste', () => {
    const { label, hint } = TOVYR_EXAMPLE_PROMPTS[0]!
    expect(resolveTovyrExamplePromptInput(`${label} - ${hint}`)).toBe(hint)
  })

  test('resolveTovyrExamplePromptInput unwraps label em dash hint paste', () => {
    const { label, hint } = TOVYR_EXAMPLE_PROMPTS[0]!
    expect(resolveTovyrExamplePromptInput(`${label} — ${hint}`)).toBe(hint)
  })

  test('resolveTovyrExamplePromptInput unwraps mojibake separator paste', () => {
    const { label, hint } = TOVYR_EXAMPLE_PROMPTS[0]!
    expect(
      resolveTovyrExamplePromptInput(`${label} ┌Çö ${hint}`),
    ).toBe(hint)
  })

  test('resolveTovyrExamplePromptInput leaves unrelated text alone', () => {
    const text = 'Fix the login form validation'
    expect(resolveTovyrExamplePromptInput(text)).toBe(text)
  })
})
