import { describe, expect, test } from 'bun:test'
import { assignOrchestrationRoles } from './roleRouter.js'

describe('assignOrchestrationRoles', () => {
  test('uses distinct ready models for plan, build, and independent verification', () => {
    const result = assignOrchestrationRoles({
      providerId: 'nvidia_nim',
      models: [
        {
          modelId: 'reasoning-large',
          state: 'ready',
          supportsTools: true,
          reasoning: true,
          contextWindow: 128_000,
          latencyMs: 900,
        },
        {
          modelId: 'tool-coder',
          state: 'ready',
          supportsTools: true,
          reasoning: false,
          contextWindow: 64_000,
          latencyMs: 300,
        },
        {
          modelId: 'review-model',
          state: 'ready',
          supportsTools: true,
          reasoning: true,
          contextWindow: 64_000,
          latencyMs: 500,
        },
      ],
    })

    expect(result.assignments).toMatchObject({
      planner: { modelId: 'reasoning-large' },
      builder: { modelId: 'tool-coder' },
      verifier: { modelId: 'review-model' },
    })
    expect(result.warnings).toEqual([])
  })

  test('shares one eligible model honestly when no independent model exists', () => {
    const result = assignOrchestrationRoles({
      providerId: 'openrouter',
      models: [
        {
          modelId: 'only-model',
          state: 'ready',
          supportsTools: true,
          reasoning: true,
          contextWindow: 32_000,
          latencyMs: 200,
        },
        {
          modelId: 'chat-only',
          state: 'chat_only',
          supportsTools: false,
          reasoning: true,
          contextWindow: 128_000,
          latencyMs: 100,
        },
      ],
    })

    expect(new Set(Object.values(result.assignments).map(a => a.modelId))).toEqual(
      new Set(['only-model']),
    )
    // The warning must name the model and say how to get independent
    // verification, not just observe that there isn't any.
    expect(result.warnings[0]).toContain('only-model')
    expect(result.warnings[0]).toContain('/provider')
  })

  test('refuses orchestration when no ready tool-capable model exists', () => {
    expect(
      assignOrchestrationRoles({
        providerId: 'nvidia_nim',
        models: [
          {
            modelId: 'slow',
            state: 'slow',
            supportsTools: true,
            reasoning: true,
            contextWindow: 128_000,
          },
        ],
      }).ok,
    ).toBe(false)
  })

  test('pairs Fable planning with Opus implementation and independent verification', () => {
    const result = assignOrchestrationRoles({
      providerId: 'anthropic',
      models: [
        {
          modelId: 'claude-opus-5',
          state: 'ready',
          supportsTools: true,
          reasoning: true,
          contextWindow: 1_000_000,
          latencyMs: 450,
        },
        {
          modelId: 'claude-fable-5',
          state: 'ready',
          supportsTools: true,
          reasoning: true,
          contextWindow: 1_000_000,
          latencyMs: 300,
        },
        {
          modelId: 'claude-sonnet-5',
          state: 'ready',
          supportsTools: true,
          reasoning: true,
          contextWindow: 512_000,
          latencyMs: 150,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.assignments.planner.modelId).toBe('claude-fable-5')
    expect(result.assignments.builder.modelId).toBe('claude-opus-5')
    expect(result.assignments.verifier.modelId).toBe('claude-sonnet-5')
  })
})
