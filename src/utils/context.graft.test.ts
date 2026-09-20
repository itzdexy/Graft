import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getModelMaxOutputTokens } from './context.js'

let previousPackageRoot: string | undefined

beforeEach(() => {
  previousPackageRoot = process.env.GRAFT_PACKAGE_ROOT
  process.env.GRAFT_PACKAGE_ROOT = 'test'
})

afterEach(() => {
  if (previousPackageRoot === undefined) {
    delete process.env.GRAFT_PACKAGE_ROOT
  } else {
    process.env.GRAFT_PACKAGE_ROOT = previousPackageRoot
  }
})

describe('Graft model output limits', () => {
  test('keeps Claude-family limits on the Claude path', () => {
    expect(getModelMaxOutputTokens('claude-opus-4-6')).toEqual({
      default: 64_000,
      upperLimit: 128_000,
    })
  })

  test('uses provider context limits for non-Claude models', () => {
    expect(getModelMaxOutputTokens('gpt-5.6')).toEqual({
      default: 8_000,
      upperLimit: 32_000,
    })
  })

  test('uses conservative limits for unknown non-Claude models', () => {
    expect(getModelMaxOutputTokens('custom-openai-model')).toEqual({
      default: 4_096,
      upperLimit: 8_192,
    })
  })
})
