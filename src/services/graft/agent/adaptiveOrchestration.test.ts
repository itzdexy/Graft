import { afterEach, describe, expect, test } from 'bun:test'
import { resetModelReadiness, setModelReadiness } from '../modelReadiness.js'
import { createAdaptiveOrchestration } from './adaptiveOrchestration.js'

describe('createAdaptiveOrchestration', () => {
  afterEach(resetModelReadiness)

  test('uses only fresh readiness evidence from the active provider', () => {
    const checkedAt = Date.now()
    setModelReadiness({
      providerId: 'anthropic', modelId: 'claude-sonnet-5', state: 'ready', source: 'probe',
      checkedAt, supportsTools: true, hardFailure: false,
    })
    setModelReadiness({
      providerId: 'openrouter', modelId: 'openai/gpt-5', state: 'ready', source: 'probe',
      checkedAt, supportsTools: true, hardFailure: false,
    })

    const result = createAdaptiveOrchestration(
      'build a full authentication frontend, backend, and test suite across multiple files',
      'anthropic',
    )
    expect(result?.assignments.builder.providerId).toBe('anthropic')
    expect(result?.assignments.builder.modelId).toBe('claude-sonnet-5')
    expect(result?.warnings[0]).toContain('/provider')
  })

  test('keeps approval checkpoints on the active model while readiness is cold', () => {
    const result = createAdaptiveOrchestration(
      'build a full authentication frontend, backend, and test suite across multiple files',
      'anthropic',
    )
    expect(result).toMatchObject({
      state: 'ideating',
      approvalPolicy: 'ideas-and-plan',
    })
    expect(result?.assignments.planner.modelId).toBe(
      result?.assignments.builder.modelId,
    )
    expect(result?.warnings[0]).toContain('active model')
  })
})
