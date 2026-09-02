import { describe, expect, test } from 'bun:test'
import { parseOpenAiModelDescriptors } from './providerModels.js'
import { getTovyrMaxOutputLimits } from './modelContext.js'

/**
 * The provider reports its own output ceiling; Tovyr inferred one from four
 * coarse context-window tiers that top out at 32k. stealth/ox-alpha reports
 * 131,072, so replies were capped at a quarter of what the model can emit.
 */
describe('provider-reported max output tokens', () => {
  test('is parsed from top_provider.max_completion_tokens', () => {
    const [model] = parseOpenAiModelDescriptors({
      data: [
        {
          id: 'stealth/ox-alpha',
          context_length: 1_048_576,
          top_provider: { context_length: 1_048_576, max_completion_tokens: 131_072 },
        },
      ],
    })
    expect(model?.maxOutputTokens).toBe(131_072)
  })

  test('is null when the provider does not report one', () => {
    const [model] = parseOpenAiModelDescriptors({
      data: [{ id: 'bare/model', context_length: 128_000 }],
    })
    expect(model?.maxOutputTokens).toBeNull()
  })

  test('the tier fallback still tops out well below a real 131k ceiling', () => {
    // Documents what the tiers give, which is why the reported value matters.
    expect(getTovyrMaxOutputLimits(1_048_576).upperLimit).toBe(32_000)
    expect(getTovyrMaxOutputLimits(1_048_576).upperLimit).toBeLessThan(131_072)
  })

  test('tiers stay monotonic across window sizes', () => {
    const windows = [8_192, 32_768, 65_536, 1_048_576]
    const limits = windows.map(w => getTovyrMaxOutputLimits(w).upperLimit)
    for (let i = 1; i < limits.length; i++) {
      expect(limits[i]!).toBeGreaterThanOrEqual(limits[i - 1]!)
    }
  })
})
