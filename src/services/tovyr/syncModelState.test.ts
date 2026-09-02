import { describe, expect, test } from 'bun:test'
import type { AppState } from '../../state/AppStateStore.js'
import { patchAppStateForTovyrModel } from './syncModelState.js'

describe('patchAppStateForTovyrModel', () => {
  test('updates main loop model and clears session override', () => {
    const prev = {
      mainLoopModel: 'old-model',
      mainLoopModelForSession: 'session-only',
    } as AppState

    const next = patchAppStateForTovyrModel(prev, 'meta/llama-3.1-70b-instruct')

    expect(next.mainLoopModel).toBe('meta/llama-3.1-70b-instruct')
    expect(next.mainLoopModelForSession).toBeNull()
    expect(prev.mainLoopModel).toBe('old-model')
  })
})