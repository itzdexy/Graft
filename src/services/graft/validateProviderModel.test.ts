import { describe, expect, test } from 'bun:test'
import {
  isModelVerifiedForProvider,
  reconcileModelWithVerified,
  resolveModelInVerifiedList,
} from './validateProviderModel.js'

const NIM_VERIFIED = [
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-8b-instruct',
  'deepseek-ai/deepseek-r1',
]

describe('validateProviderModel', () => {
  test('resolveModelInVerifiedList matches vendor-prefixed ids', () => {
    expect(
      resolveModelInVerifiedList('nvidia/nemotron-4-340b-instruct', NIM_VERIFIED),
    ).toBeNull()
    expect(
      resolveModelInVerifiedList('meta/llama-3.1-70b-instruct', NIM_VERIFIED),
    ).toBe('meta/llama-3.1-70b-instruct')
    expect(
      resolveModelInVerifiedList('llama-3.1-70b-instruct', NIM_VERIFIED),
    ).toBe('meta/llama-3.1-70b-instruct')
  })

  test('isModelVerifiedForProvider rejects unavailable models', () => {
    expect(
      isModelVerifiedForProvider('nvidia/nemotron-4-340b-instruct', NIM_VERIFIED),
    ).toBe(false)
    expect(
      isModelVerifiedForProvider('meta/llama-3.1-70b-instruct', NIM_VERIFIED),
    ).toBe(true)
  })

  test('reconcileModelWithVerified picks default when saved model is invalid', () => {
    const prevRoot = process.env.GRAFT_PACKAGE_ROOT
    process.env.GRAFT_PACKAGE_ROOT = '1'
    try {
      const { model, corrected } = reconcileModelWithVerified(
        'nvidia_nim',
        'nvidia/nemotron-4-340b-instruct',
        NIM_VERIFIED,
      )
      expect(corrected).toBe(true)
      expect(model).toBe('meta/llama-3.1-8b-instruct')
    } finally {
      if (prevRoot === undefined) delete process.env.GRAFT_PACKAGE_ROOT
      else process.env.GRAFT_PACKAGE_ROOT = prevRoot
    }
  })
})
