import { describe, expect, test } from 'bun:test'
import {
  GRAFT_EXAMPLE_PROMPTS,
  resolveGraftExamplePromptInput,
} from './graftExamplePrompts.js'

describe('graftExamplePrompts', () => {
  test('resolveGraftExamplePromptInput keeps plain hints', () => {
    const hint = GRAFT_EXAMPLE_PROMPTS[0]!.hint
    expect(resolveGraftExamplePromptInput(hint)).toBe(hint)
  })

  test('resolveGraftExamplePromptInput unwraps label - hint paste', () => {
    const { label, hint } = GRAFT_EXAMPLE_PROMPTS[0]!
    expect(resolveGraftExamplePromptInput(`${label} - ${hint}`)).toBe(hint)
  })

  test('resolveGraftExamplePromptInput unwraps label em dash hint paste', () => {
    const { label, hint } = GRAFT_EXAMPLE_PROMPTS[0]!
    expect(resolveGraftExamplePromptInput(`${label} — ${hint}`)).toBe(hint)
  })

  test('resolveGraftExamplePromptInput unwraps mojibake separator paste', () => {
    const { label, hint } = GRAFT_EXAMPLE_PROMPTS[0]!
    expect(
      resolveGraftExamplePromptInput(`${label} ┌Çö ${hint}`),
    ).toBe(hint)
  })

  test('resolveGraftExamplePromptInput leaves unrelated text alone', () => {
    const text = 'Fix the login form validation'
    expect(resolveGraftExamplePromptInput(text)).toBe(text)
  })
})
