import { describe, expect, test } from 'bun:test'
import {
  compactLivePreview,
  isGraftStreamingPreviewDuplicate,
  shouldShowGraftGenericStatus,
} from './GraftLiveActivity.js'

describe('GraftLiveActivity generic status row', () => {
  test('shows the generic status while waiting on the model', () => {
    expect(
      shouldShowGraftGenericStatus({
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
      shouldShowGraftGenericStatus({
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
      shouldShowGraftGenericStatus({
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
      shouldShowGraftGenericStatus({
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
      shouldShowGraftGenericStatus({
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
      shouldShowGraftGenericStatus({
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
      shouldShowGraftGenericStatus({
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

describe('isGraftStreamingPreviewDuplicate', () => {
  test('hides exact match and catch-up prefixes', () => {
    expect(
      isGraftStreamingPreviewDuplicate('Hello world', 'Hello world'),
    ).toBe(true)
    expect(isGraftStreamingPreviewDuplicate('Hello', 'Hello world')).toBe(true)
  })

  test('keeps growing stream past committed text', () => {
    expect(
      isGraftStreamingPreviewDuplicate(
        'Hello world — with more',
        'Hello world',
      ),
    ).toBe(false)
  })
})

describe('compactLivePreview', () => {
  test('normalizes whitespace without changing short content', () => {
    expect(compactLivePreview('  checking\n  files   now ', 80)).toBe(
      'checking files now',
    )
  })

  test('keeps the newest part of a long live stream', () => {
    const preview = compactLivePreview(
      'old context that should leave the window while the newest live activity remains visible',
      42,
    )
    expect(preview.startsWith('… ')).toBe(true)
    expect(preview).toContain('newest live activity remains visible')
    expect(preview).not.toContain('old context')
  })
})
