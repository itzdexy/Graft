import { describe, expect, test } from 'bun:test'
import {
  formatModelActivationFailure,
  runModelActivationAttempt,
} from './modelActivationFlow.js'

describe('custom model activation flow', () => {
  test('reports the active model as unchanged when a candidate times out', () => {
    expect(
      formatModelActivationFailure(
        {
          ok: false,
          providerId: 'nvidia_nim',
          modelId: 'deepseek-ai/deepseek-v4-flash-0731',
          readiness: 'slow',
          message:
            'deepseek-ai/deepseek-v4-flash-0731 did not respond within 8s. Try again or choose another model.',
        },
        {
          providerLabel: 'NVIDIA NIM',
          modelId: 'meta/llama-3.1-8b-instruct',
        },
      ),
    ).toBe(
      'Not switched — deepseek-ai/deepseek-v4-flash-0731 did not respond within 8s. Try again or choose another model. Still using NVIDIA NIM · meta/llama-3.1-8b-instruct.',
    )
  })

  test('blocks a second Enter while the first activation is pending', async () => {
    let resolveActivation!: (value: {
      ok: true
      providerId: string
      modelId: string
      readiness: 'ready'
    }) => void
    const activation = new Promise<{
      ok: true
      providerId: string
      modelId: string
      readiness: 'ready'
    }>(resolve => {
      resolveActivation = resolve
    })
    let activationCalls = 0
    const lock = { current: false }
    const states: string[] = []
    const input = {
      lock,
      providerId: 'nvidia_nim',
      providerLabel: 'NVIDIA NIM',
      modelId: 'candidate',
      active: {
        providerLabel: 'NVIDIA NIM',
        modelId: 'current',
      },
      activate: async () => {
        activationCalls += 1
        return activation
      },
      onChecking: () => states.push('checking'),
      onFailure: () => states.push('failure'),
      onSuccess: () => states.push('success'),
    }

    const first = runModelActivationAttempt(input)
    const second = await runModelActivationAttempt(input)

    expect(second).toBe(false)
    expect(activationCalls).toBe(1)
    expect(states).toEqual(['checking'])

    resolveActivation({
      ok: true,
      providerId: 'nvidia_nim',
      modelId: 'candidate',
      readiness: 'ready',
    })
    expect(await first).toBe(true)
    expect(states).toEqual(['checking', 'success'])
    expect(lock.current).toBe(false)
  })

  test('keeps a failed attempt inline so Enter can retry', async () => {
    const lock = { current: false }
    const failures: string[] = []
    let calls = 0
    const attempt = () =>
      runModelActivationAttempt({
        lock,
        providerId: 'nvidia_nim',
        providerLabel: 'NVIDIA NIM',
        modelId: 'candidate',
        active: { providerLabel: 'NVIDIA NIM', modelId: 'current' },
        activate: async () => {
          calls += 1
          return {
            ok: false as const,
            providerId: 'nvidia_nim',
            modelId: 'candidate',
            readiness: 'slow' as const,
            message: 'candidate did not answer the check.',
          }
        },
        onChecking: () => {},
        onSuccess: () => {},
        onFailure: message => failures.push(message),
      })

    expect(await attempt()).toBe(false)
    expect(await attempt()).toBe(false)
    expect(calls).toBe(2)
    expect(failures).toHaveLength(2)
  })
})
