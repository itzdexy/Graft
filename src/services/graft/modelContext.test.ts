import { describe, expect, test } from 'bun:test'
import {
  anthropicRequestToOpenAi,
  type AnthropicMessagesRequest,
} from './openaiCompat/convert.js'
import {
  capMaxTokensForContextWindow,
  getGraftMaxOutputLimits,
  inferContextWindowFromModelId,
  preflightAnthropicRequestContext,
} from './modelContext.js'

describe('modelContext', () => {
  test('infers 32k from llama 3.2 90b vision id', () => {
    expect(
      inferContextWindowFromModelId('meta/llama-3.2-90b-vision-instruct'),
    ).toBe(32_768)
  })

  test('uses the 128k window for Llama 3.1 models', () => {
    expect(
      inferContextWindowFromModelId('meta/llama-3.1-8b-instruct'),
    ).toBe(131_072)
  })

  test('uses NVIDIA NIM context metadata for Nemotron 3 Nano', () => {
    expect(
      inferContextWindowFromModelId('nvidia/nemotron-3-nano-30b-a3b'),
    ).toBe(262_144)
  })

  test('uses a 1M window for Muse Spark', () => {
    expect(inferContextWindowFromModelId('muse-spark-1.3-contributor')).toBe(
      1_000_000,
    )
  })

  test('caps max_tokens when input + completion exceeds window', () => {
    const capped = capMaxTokensForContextWindow(32_000, 32_768, 5_072)
    expect(capped).toBeLessThanOrEqual(32_768 - 5_072 - 512)
    expect(capped).toBeGreaterThan(0)
  })

  test('getGraftMaxOutputLimits stays modest for 32k models', () => {
    const limits = getGraftMaxOutputLimits(32_768)
    expect(limits.upperLimit).toBeLessThanOrEqual(8_192)
  })

  test('anthropicRequestToOpenAi caps 32k default for small-context model', () => {
    const body: AnthropicMessagesRequest = {
      model: 'meta/llama-3.2-90b-vision-instruct',
      max_tokens: 32_000,
      messages: [{ role: 'user', content: 'hi' }],
    }
    const openAi = anthropicRequestToOpenAi(body)
    expect(openAi.max_tokens).toBeLessThan(32_000)
    expect(openAi.max_tokens).toBeLessThanOrEqual(8_192)
  })

  test('preflightGraftRequestContext rejects input larger than model window', () => {
    const result = preflightAnthropicRequestContext({
      model: 'meta/llama-3.1-70b-instruct-128k',
      max_tokens: 8_000,
      messages: [{ role: 'user', content: 'x'.repeat(520_000) }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.contextWindow).toBe(128_000)
      expect(result.message).toContain('/compact')
      expect(result.message).toContain('/model')
    }
  })

  test('preflightGraftRequestContext allows requests within the model window', () => {
    const result = preflightAnthropicRequestContext({
      model: 'meta/llama-3.1-70b-instruct-128k',
      max_tokens: 8_000,
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(result.ok).toBe(true)
  })
})
