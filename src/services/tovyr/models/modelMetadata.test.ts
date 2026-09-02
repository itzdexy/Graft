import { describe, expect, test } from 'bun:test'
import {
  deriveModelTags,
  formatMaxOutputTag,
  parseInputModalities,
  formatContextTag,
  formatPriceTag,
  isFreeModel,
  parseModelPricing,
  parseSupportsTools,
  parseSupportsVision,
} from './modelMetadata.js'

describe('parseModelPricing', () => {
  test('parses OpenRouter string per-token prices into per-million', () => {
    expect(
      parseModelPricing({ prompt: '0.000003', completion: '0.000015' }),
    ).toEqual({ promptPerM: 3, completionPerM: 15 })
  })

  test('parses numeric prices', () => {
    expect(parseModelPricing({ prompt: 0.0000005, completion: 0.0000015 })).toEqual({
      promptPerM: 0.5,
      completionPerM: 1.5,
    })
  })

  test('accepts input/output aliases', () => {
    expect(parseModelPricing({ input: '0.000001', output: '0.000002' })).toEqual({
      promptPerM: 1,
      completionPerM: 2,
    })
  })

  test('zero prices parse as zero, not as missing', () => {
    expect(parseModelPricing({ prompt: '0', completion: '0' })).toEqual({
      promptPerM: 0,
      completionPerM: 0,
    })
  })

  test('missing pricing is null, which is not the same as free', () => {
    expect(parseModelPricing(undefined)).toBeNull()
    expect(parseModelPricing({})).toBeNull()
    expect(parseModelPricing({ request: '0' })).toBeNull()
  })

  test('unparseable values are ignored', () => {
    expect(parseModelPricing({ prompt: 'n/a', completion: 'n/a' })).toBeNull()
  })

  test('a one-sided price still yields a pricing object', () => {
    expect(parseModelPricing({ prompt: '0.000002' })).toEqual({
      promptPerM: 2,
      completionPerM: 0,
    })
  })
})

describe('isFreeModel', () => {
  test('both sides zero is free', () => {
    expect(isFreeModel({ promptPerM: 0, completionPerM: 0 })).toBe(true)
  })

  test('unknown pricing is never reported as free', () => {
    expect(isFreeModel(null)).toBe(false)
  })

  test('a paid model is not free', () => {
    expect(isFreeModel({ promptPerM: 3, completionPerM: 15 })).toBe(false)
  })
})

describe('formatPriceTag', () => {
  test('free models say FREE', () => {
    expect(formatPriceTag({ promptPerM: 0, completionPerM: 0 })).toBe('FREE')
  })

  test('sub-dollar prices keep two decimals', () => {
    expect(formatPriceTag({ promptPerM: 0.15, completionPerM: 0.6 })).toBe('$0.15/M')
  })

  test('single-digit prices keep one decimal', () => {
    expect(formatPriceTag({ promptPerM: 3, completionPerM: 15 })).toBe('$3.0/M')
  })

  test('large prices round to whole dollars', () => {
    expect(formatPriceTag({ promptPerM: 75, completionPerM: 150 })).toBe('$75/M')
  })

  test('unknown pricing produces no tag', () => {
    expect(formatPriceTag(null)).toBeNull()
  })
})

describe('formatContextTag', () => {
  test('renders millions', () => {
    expect(formatContextTag(1_000_000)).toBe('1M ctx')
    expect(formatContextTag(2_000_000)).toBe('2M ctx')
  })

  test('a binary 1M window reads as 1M, not 1.0M', () => {
    // 1048576 is what OpenRouter actually reports for 1M-context models.
    expect(formatContextTag(1_048_576)).toBe('1M ctx')
  })

  test('a genuinely fractional window keeps one decimal', () => {
    expect(formatContextTag(1_500_000)).toBe('1.5M ctx')
  })

  test('renders thousands', () => {
    expect(formatContextTag(128_000)).toBe('128k ctx')
    expect(formatContextTag(200_000)).toBe('200k ctx')
  })

  test('missing or zero context produces no tag', () => {
    expect(formatContextTag(null)).toBeNull()
    expect(formatContextTag(0)).toBeNull()
  })
})

describe('parseSupportsTools', () => {
  test('detects tools in supported_parameters', () => {
    expect(
      parseSupportsTools({ supportedParameters: ['max_tokens', 'tools'] }),
    ).toBe(true)
  })

  test('a parameter list without tools is a definite no', () => {
    expect(parseSupportsTools({ supportedParameters: ['max_tokens'] })).toBe(false)
  })

  test('no parameter list is unknown, not false', () => {
    expect(parseSupportsTools({})).toBeNull()
  })
})

describe('parseSupportsVision', () => {
  test('reads input_modalities', () => {
    expect(
      parseSupportsVision({
        architecture: { input_modalities: ['text', 'image'] },
      }),
    ).toBe(true)
    expect(
      parseSupportsVision({ architecture: { input_modalities: ['text'] } }),
    ).toBe(false)
  })

  test('falls back to the modality string', () => {
    expect(
      parseSupportsVision({ architecture: { modality: 'text+image->text' } }),
    ).toBe(true)
    expect(
      parseSupportsVision({ architecture: { modality: 'text->text' } }),
    ).toBe(false)
  })

  test('image only in the OUTPUT modality is not vision input', () => {
    expect(
      parseSupportsVision({ architecture: { modality: 'text->image' } }),
    ).toBe(false)
  })

  test('no architecture is unknown', () => {
    expect(parseSupportsVision({})).toBeNull()
  })
})

describe('deriveModelTags', () => {
  const base = {
    pricing: null,
    contextTokens: null,
    supportsTools: null,
    supportsVision: null,
  }

  test('a free tool-capable model reads at a glance', () => {
    expect(
      deriveModelTags({
        ...base,
        pricing: { promptPerM: 0, completionPerM: 0 },
        contextTokens: 1_000_000,
        supportsTools: true,
      }),
    ).toEqual(['FREE', 'TOOLS', '1M ctx'])
  })

  test('modalities are listed so audio and video models are findable', () => {
    expect(
      deriveModelTags({
        ...base,
        contextTokens: 128_000,
        modalities: ['text', 'image', 'audio'],
      }),
    ).toEqual(['128k ctx', 'IMAGE', 'AUDIO'])
  })

  test('"text" is the baseline and never tagged on its own', () => {
    expect(deriveModelTags({ ...base, modalities: ['text'] })).toEqual([])
  })

  test('vision falls back to IMAGE when no modality list is given', () => {
    expect(deriveModelTags({ ...base, supportsVision: true })).toEqual(['IMAGE'])
  })

  test('the response ceiling is shown next to the context window', () => {
    expect(
      deriveModelTags({
        ...base,
        contextTokens: 200_000,
        maxOutputTokens: 32_768,
      }),
    ).toEqual(['200k ctx', '33k out'])
  })

  test('a paid vision model shows price first', () => {
    expect(
      deriveModelTags({
        ...base,
        pricing: { promptPerM: 3, completionPerM: 15 },
        contextTokens: 200_000,
        supportsTools: true,
        supportsVision: true,
      }),
    ).toEqual(['$3.0/M', 'TOOLS', '200k ctx', 'IMAGE'])
  })

  test('local models show LOCAL instead of a price', () => {
    expect(
      deriveModelTags({
        ...base,
        local: true,
        pricing: { promptPerM: 0, completionPerM: 0 },
        contextTokens: 32_000,
      }),
    ).toEqual(['LOCAL', '32k ctx'])
  })

  test('models that cannot run agent work are tagged, not hidden', () => {
    expect(
      deriveModelTags({ ...base, notAgentCapable: true, supportsTools: true }),
    ).toEqual(['NO TOOLS'])
  })

  test('unknown metadata yields no tags rather than wrong ones', () => {
    expect(deriveModelTags(base)).toEqual([])
  })
})

describe('parseInputModalities', () => {
  test('reads an explicit list', () => {
    expect(
      parseInputModalities({
        architecture: { input_modalities: ['text', 'image', 'video'] },
      }),
    ).toEqual(['text', 'image', 'video'])
  })

  test('falls back to the modality string', () => {
    expect(
      parseInputModalities({ architecture: { modality: 'text+audio->text' } }),
    ).toEqual(['text', 'audio'])
  })

  test('no architecture yields nothing', () => {
    expect(parseInputModalities({})).toEqual([])
  })
})

describe('formatMaxOutputTag', () => {
  test('rounds to thousands', () => {
    expect(formatMaxOutputTag(32_768)).toBe('33k out')
    expect(formatMaxOutputTag(131_072)).toBe('131k out')
  })

  test('small ceilings stay exact', () => {
    expect(formatMaxOutputTag(512)).toBe('512 out')
  })

  test('missing ceiling produces no tag', () => {
    expect(formatMaxOutputTag(null)).toBeNull()
    expect(formatMaxOutputTag(0)).toBeNull()
  })
})
