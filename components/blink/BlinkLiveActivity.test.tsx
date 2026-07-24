import { describe, expect, test } from 'bun:test'
import {
  isBlinkStreamingPreviewDuplicate,
  shouldShowBlinkGenericStatus,
} from './BlinkLiveActivity.js'

describe('BlinkLiveActivity generic status row', () => {
  test('shows the generic status while waiting on the model', () => {
    expect(
      shouldShowBlinkGenericStatus({
        isLoading: true,
        suppressIdleStatus: false,
        concreteRowCount: 0,
        showThought: false,
        streamMode: 'requesting',
      }),
    ).toBe(true)
  })

  test('suppresses generic status when a concrete live tool row exists', () => {
    expect(
      shouldShowBlinkGenericStatus({
        isLoading: true,
        suppressIdleStatus: false,
        concreteRowCount: 1,
        showThought: false,
        streamMode: 'tool-use',
      }),
    ).toBe(false)
  })

  test('suppresses duplicate thinking status when the thought row is visible', () => {
    expect(
      shouldShowBlinkGenericStatus({
        isLoading: true,
        suppressIdleStatus: false,
        concreteRowCount: 0,
        showThought: true,
        streamMode: 'thinking',
      }),
    ).toBe(false)
  })

  test('suppresses generic status when response streaming preview is visible', () => {
    expect(
      shouldShowBlinkGenericStatus({
        isLoading: true,
        suppressIdleStatus: false,
        concreteRowCount: 0,
        showThought: false,
        streamMode: 'responding',
        hasStreamingPreview: true,
      }),
    ).toBe(false)
  })

  test('respects explicit idle suppression', () => {
    expect(
      shouldShowBlinkGenericStatus({
        isLoading: true,
        suppressIdleStatus: true,
        concreteRowCount: 0,
        showThought: false,
        streamMode: 'responding',
      }),
    ).toBe(false)
  })

  test('shows status when showSpinner is true even if isLoading is false', () => {
    expect(
      shouldShowBlinkGenericStatus({
        isLoading: false,
        suppressIdleStatus: false,
        concreteRowCount: 0,
        showThought: false,
        streamMode: 'requesting',
        showSpinner: true,
      }),
    ).toBe(true)
  })

  test('suppresses generic status when showSpinner is true but concrete tool rows exist', () => {
    expect(
      shouldShowBlinkGenericStatus({
        isLoading: false,
        suppressIdleStatus: false,
        concreteRowCount: 2,
        showThought: false,
        streamMode: 'tool-use',
        showSpinner: true,
      }),
    ).toBe(false)
  })
})

describe('isBlinkStreamingPreviewDuplicate', () => {
  test('hides exact match and catch-up prefixes', () => {
    expect(
      isBlinkStreamingPreviewDuplicate('Hello world', 'Hello world'),
    ).toBe(true)
    expect(isBlinkStreamingPreviewDuplicate('Hello', 'Hello world')).toBe(true)
  })

  test('keeps growing stream past committed text', () => {
    expect(
      isBlinkStreamingPreviewDuplicate(
        'Hello world — with more',
        'Hello world',
      ),
    ).toBe(false)
  })
})
