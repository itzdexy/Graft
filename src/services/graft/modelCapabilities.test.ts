import { describe, expect, test } from 'bun:test'
import {
  resolveModelCapabilities,
  formatCapabilitiesSummary,
  tierToCostCategory,
} from './modelCapabilities.js'

describe('modelCapabilities', () => {
  test('graft sonnet has tools, streaming, and vision', () => {
    const caps = resolveModelCapabilities('claude-sonnet-20250929', 'anthropic')
    expect(caps.toolCalling).toBe(true)
    expect(caps.streaming).toBe(true)
    expect(caps.vision).toBe(true)
    expect(caps.costCategory).toBe('standard')
    expect(caps.source).toBe('override')
  })

  test('gpt-4o via openrouter slug is inferred with vision', () => {
    const caps = resolveModelCapabilities('openai/gpt-4o', 'openrouter')
    expect(caps.vision).toBe(true)
    expect(caps.toolCalling).toBe(true)
  })

  test('embedding models disable tool calling', () => {
    const caps = resolveModelCapabilities('text-embedding-3-large', 'openai')
    expect(caps.toolCalling).toBe(false)
  })

  test('formatCapabilitiesSummary is compact', () => {
    const summary = formatCapabilitiesSummary(
      resolveModelCapabilities('claude-3-5-haiku-20241022', 'anthropic'),
    )
    expect(summary).toContain('tools')
    expect(summary).toContain('budget')
  })

  test('tierToCostCategory maps tiers', () => {
    expect(tierToCostCategory('opus')).toBe('premium')
    expect(tierToCostCategory('haiku')).toBe('budget')
  })
})
