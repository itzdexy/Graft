import { describe, expect, test } from 'bun:test'
import type { AppState } from '../../state/AppStateStore.js'
import { patchAppStateForBlinkModel } from './syncModelState.js'

describe('patchAppStateForBlinkModel', () => {
  test('updates main loop model and clears session override', () => {
    const prev = {
      mainLoopModel: 'old-model',
      mainLoopModelForSession: 'session-only',
    } as AppState

    const next = patchAppStateForBlinkModel(prev, 'meta/llama-3.1-70b-instruct')

    expect(next.mainLoopModel).toBe('meta/llama-3.1-70b-instruct')
    expect(next.mainLoopModelForSession).toBeNull()
    expect(prev.mainLoopModel).toBe('old-model')
  })
})