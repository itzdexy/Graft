import { describe, expect, test } from 'bun:test'
import { parseOpenAiModelDescriptors } from './providerModels.js'

/**
 * The provider-reported context length is the value that stops a 128k model
 * from being compacted as if it held 32k. These cover the parse step, which is
 * the part that has to keep working for the lookup to have anything to read.
 */
describe('provider-reported context length', () => {
  test('reads a top-level context_length', () => {
    const [model] = parseOpenAiModelDescriptors({
      data: [{ id: 'stealth/ox-alpha', context_length: 256_000 }],
    })
    expect(model?.contextTokens).toBe(256_000)
  })

  test('falls back to top_provider.context_length', () => {
    const [model] = parseOpenAiModelDescriptors({
      data: [{ id: 'some/model', top_provider: { context_length: 131_072 } }],
    })
    expect(model?.contextTokens).toBe(131_072)
  })

  test('prefers the top-level value over top_provider', () => {
    const [model] = parseOpenAiModelDescriptors({
      data: [
        {
          id: 'some/model',
          context_length: 200_000,
          top_provider: { context_length: 32_768 },
        },
      ],
    })
    expect(model?.contextTokens).toBe(200_000)
  })

  test('reports null when the provider says nothing', () => {
    const [model] = parseOpenAiModelDescriptors({
      data: [{ id: 'bare/model' }],
    })
    expect(model?.contextTokens).toBeNull()
  })

  test('ignores a non-numeric context_length', () => {
    const [model] = parseOpenAiModelDescriptors({
      data: [{ id: 'weird/model', context_length: '128000' }],
    })
    expect(model?.contextTokens).toBeNull()
  })
})
