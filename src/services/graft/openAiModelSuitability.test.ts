import { describe, expect, test } from 'bun:test'
import {
  isAgentSuitableOpenAiModel,
  modelUsesOpenAiThinkingKwargs,
  openAiModelChatPreferenceScore,
} from './openAiModelSuitability.js'

describe('isAgentSuitableOpenAiModel', () => {
  test('accepts instruct chat models', () => {
    expect(isAgentSuitableOpenAiModel('meta/llama-3.3-70b-instruct')).toBe(true)
    expect(isAgentSuitableOpenAiModel('meta/llama-3.1-8b-instruct')).toBe(true)
  })

  test('rejects embeds, guards, codellama, and media models', () => {
    expect(isAgentSuitableOpenAiModel('codellama')).toBe(false)
    expect(isAgentSuitableOpenAiModel('meta/codellama-34b')).toBe(false)
    expect(isAgentSuitableOpenAiModel('nv-embedqa-e5-v5')).toBe(false)
    expect(
      isAgentSuitableOpenAiModel('llama-3.1-nemoguard-8b-content-safety'),
    ).toBe(false)
    expect(isAgentSuitableOpenAiModel('whisper-large-v3')).toBe(false)
    expect(isAgentSuitableOpenAiModel('rerank-qa-mistral-4b')).toBe(false)
    expect(isAgentSuitableOpenAiModel('nvidia/nemoretriever-parse')).toBe(false)
    expect(isAgentSuitableOpenAiModel('muse-image-1.0')).toBe(false)
    expect(isAgentSuitableOpenAiModel('muse-voice-transcribe-1.0')).toBe(false)
    expect(isAgentSuitableOpenAiModel('muse-spark-1.3')).toBe(true)
  })

  test('rejects empty ids', () => {
    expect(isAgentSuitableOpenAiModel('')).toBe(false)
    expect(isAgentSuitableOpenAiModel('   ')).toBe(false)
  })
})

describe('modelUsesOpenAiThinkingKwargs', () => {
  test('detects GLM and DeepSeek-R1 style models', () => {
    expect(modelUsesOpenAiThinkingKwargs('z-ai/glm-5.2')).toBe(true)
    expect(modelUsesOpenAiThinkingKwargs('deepseek-ai/deepseek-r1')).toBe(true)
    expect(
      modelUsesOpenAiThinkingKwargs('nvidia/nemotron-3-nano-30b-a3b'),
    ).toBe(true)
    expect(modelUsesOpenAiThinkingKwargs('meta/llama-3.1-8b-instruct')).toBe(
      false,
    )
  })
})

describe('openAiModelChatPreferenceScore', () => {
  test('prefers instruct over base', () => {
    expect(
      openAiModelChatPreferenceScore('meta/llama-3.3-70b-instruct'),
    ).toBeGreaterThan(openAiModelChatPreferenceScore('meta/llama-3.3-70b-base'))
  })
})
