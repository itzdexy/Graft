import { describe, expect, test } from 'bun:test'
import {
  parseAnthropicModelDescriptors,
  parseGeminiModelDescriptors,
  parseOpenAiModelsList,
  resetProviderModelCache,
} from './providerModels.js'

describe('parseOpenAiModelsList', () => {
  test('extracts ids from OpenAI models list shape', () => {
    const ids = parseOpenAiModelsList({
      data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
    })
    expect(ids).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })

  test('deduplicates duplicate model ids from API', () => {
    const ids = parseOpenAiModelsList({
      data: [{ id: 'gpt-4o' }, { id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
    })
    expect(ids).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })

  test('skips entries without string id', () => {
    const ids = parseOpenAiModelsList({
      data: [{ id: 'ok' }, { name: 'bad' }, null, { id: 1 }],
    })
    expect(ids).toEqual(['ok'])
  })

  test('returns empty for malformed payload', () => {
    expect(parseOpenAiModelsList(null)).toEqual([])
    expect(parseOpenAiModelsList({})).toEqual([])
    expect(parseOpenAiModelsList({ data: 'nope' })).toEqual([])
  })
})

describe('native provider model metadata', () => {
  test('parses Anthropic capabilities and token limits', () => {
    const models = parseAnthropicModelDescriptors({
      data: [
        {
          id: 'claude-example',
          display_name: 'Claude Example',
          max_input_tokens: 200_000,
          max_tokens: 32_000,
          capabilities: {
            thinking: { supported: true },
            image_input: { supported: true },
            structured_outputs: { supported: true },
          },
        },
      ],
    })
    expect(models[0]).toMatchObject({
      id: 'claude-example',
      contextTokens: 200_000,
      maxOutputTokens: 32_000,
      supportsReasoning: true,
      supportsVision: true,
      supportsTools: true,
      source: 'provider',
    })
  })

  test('filters Gemini entries that cannot generate content', () => {
    const models = parseGeminiModelDescriptors({
      models: [
        {
          name: 'models/gemini-live',
          displayName: 'Gemini Live',
          inputTokenLimit: 1_000_000,
          outputTokenLimit: 64_000,
          supportedGenerationMethods: [
            'generateContent',
            'streamGenerateContent',
          ],
        },
        {
          name: 'models/text-embedding',
          supportedGenerationMethods: ['embedContent'],
        },
      ],
    })
    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      id: 'gemini-live',
      supportsStreaming: true,
      contextTokens: 1_000_000,
    })
  })
})

describe('resetProviderModelCache', () => {
  test('does not throw', () => {
    resetProviderModelCache()
    expect(true).toBe(true)
  })
})
