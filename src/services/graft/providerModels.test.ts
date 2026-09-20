import { describe, expect, test } from 'bun:test'
import {
  buildOpenAiModelListCandidateUrls,
  parseAnthropicModelDescriptors,
  parseGeminiModelDescriptors,
  parseModelListPayload,
  parseOpenAiModelsList,
  parseOpenAiModelDescriptors,
  payloadHasOpenAiModelMetadata,
  resetProviderModelCache,
} from './providerModels.js'

describe('buildOpenAiModelListCandidateUrls', () => {
  test('recognizes context capacity fields from compatible endpoints', () => {
    for (const field of ['context_length', 'context_window', 'max_model_len', 'max_input_tokens']) {
      expect(parseOpenAiModelDescriptors({data: [{id: 'example', [field]: 262144}]})[0]?.contextTokens).toBe(262144)
    }
  })
  test('does not duplicate the v1 segment when a provider base already ends in v1', () => {
    expect(
      buildOpenAiModelListCandidateUrls([
        'https://integrate.api.nvidia.com/v1',
      ]),
    ).toEqual(['https://integrate.api.nvidia.com/v1/models'])
  })

  test('tries root and v1 model-list shapes once for an unversioned base', () => {
    expect(
      buildOpenAiModelListCandidateUrls([
        'https://example.test',
        'https://example.test/v1',
      ]),
    ).toEqual([
      'https://example.test/models',
      'https://example.test/v1/models',
    ])
  })
})

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

describe('parseModelListPayload dispatch', () => {
  const openRouterShape = {
    data: [
      {
        id: 'stealth/ox-alpha',
        name: 'Ox Alpha',
        context_length: 1_048_576,
        pricing: { prompt: '0', completion: '0' },
        architecture: { input_modalities: ['text', 'image'] },
        supported_parameters: ['tools'],
      },
    ],
  }

  const anthropicShape = {
    data: [
      { id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5', type: 'model' },
    ],
  }

  test('detects OpenAI/OpenRouter metadata', () => {
    expect(payloadHasOpenAiModelMetadata(openRouterShape)).toBe(true)
    expect(payloadHasOpenAiModelMetadata(anthropicShape)).toBe(false)
  })

  test('a rich payload keeps its metadata regardless of provider flags', () => {
    // OpenRouter is not flagged as an OpenAI-compat provider, so this payload
    // used to be parsed by the Anthropic parser, which dropped every price,
    // context length and modality.
    const [model] = parseModelListPayload(openRouterShape)
    expect(model!.tags).toEqual(['FREE', 'TOOLS', '1M ctx', 'IMAGE'])
    expect(model!.pricing).toEqual({ promptPerM: 0, completionPerM: 0 })
  })

  test('a plain Anthropic payload still parses', () => {
    const [model] = parseModelListPayload(anthropicShape)
    expect(model!.id).toBe('claude-sonnet-5')
  })

  test('garbage payloads yield nothing rather than throwing', () => {
    expect(parseModelListPayload(null)).toEqual([])
    expect(parseModelListPayload({ data: 'nope' })).toEqual([])
  })
})
