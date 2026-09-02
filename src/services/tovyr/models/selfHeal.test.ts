import { describe, expect, test } from 'bun:test'
import {
  formatSelfHealNotice,
  isModelGoneError,
  planModelSelfHeal,
} from './selfHeal.js'

describe('planModelSelfHeal', () => {
  const live = ['anthropic/claude-sonnet-5', 'openai/gpt-5', 'meta/llama-3.3-70b']

  test('prefers the first preferred model that is actually live', () => {
    expect(
      planModelSelfHeal({
        failedModel: 'tencent/hy-mt2-1.8b',
        liveIds: live,
        preferred: ['does/not-exist', 'openai/gpt-5'],
      }),
    ).toEqual({ to: 'openai/gpt-5', from: 'tencent/hy-mt2-1.8b' })
  })

  test('falls back to the first live model when no preference matches', () => {
    expect(
      planModelSelfHeal({ failedModel: 'gone', liveIds: live })?.to,
    ).toBe('anthropic/claude-sonnet-5')
  })

  test('never switches back to the model that just failed', () => {
    expect(
      planModelSelfHeal({
        failedModel: 'openai/gpt-5',
        liveIds: ['openai/gpt-5'],
      }),
    ).toBeNull()
  })

  test('never re-picks a model already tried this session', () => {
    // Without this the recovery loops between two dead models.
    expect(
      planModelSelfHeal({
        failedModel: 'a',
        liveIds: ['a', 'b', 'c'],
        exclude: new Set(['b']),
      })?.to,
    ).toBe('c')
  })

  test('returns null when the provider list is unavailable', () => {
    // Guessing would move the failure without telling the user what changed.
    expect(
      planModelSelfHeal({ failedModel: 'gone', liveIds: [] }),
    ).toBeNull()
  })

  test('returns null when everything live is excluded', () => {
    expect(
      planModelSelfHeal({
        failedModel: 'a',
        liveIds: ['a', 'b'],
        exclude: new Set(['b']),
      }),
    ).toBeNull()
  })

  test('ignores an empty failed model', () => {
    expect(planModelSelfHeal({ failedModel: '  ', liveIds: live })).toBeNull()
  })
})

describe('formatSelfHealNotice', () => {
  test('says what broke, what replaced it, and how to change it', () => {
    const notice = formatSelfHealNotice(
      { from: 'tencent/hy-mt2-1.8b', to: 'openai/gpt-5' },
      'OpenRouter',
    )
    expect(notice).toContain('tencent/hy-mt2-1.8b')
    expect(notice).toContain('OpenRouter')
    expect(notice).toContain('openai/gpt-5')
    expect(notice).toContain('/model')
  })
})

describe('isModelGoneError', () => {
  test('410 Gone is the case from the report', () => {
    expect(isModelGoneError({ status: 410 })).toBe(true)
  })

  test('404 counts', () => {
    expect(isModelGoneError({ status: 404 })).toBe(true)
  })

  test('provider error codes count', () => {
    expect(isModelGoneError({ code: 'model_not_found' })).toBe(true)
    expect(isModelGoneError({ code: 'invalid_model' })).toBe(true)
  })

  test('OpenRouter phrasing counts', () => {
    expect(
      isModelGoneError({ message: 'No endpoints found for tencent/hy-mt2-1.8b' }),
    ).toBe(true)
  })

  test('unrelated failures do not trigger a model switch', () => {
    expect(isModelGoneError({ status: 429 })).toBe(false)
    expect(isModelGoneError({ status: 500 })).toBe(false)
    expect(isModelGoneError({ message: 'rate limit exceeded' })).toBe(false)
    expect(isModelGoneError({})).toBe(false)
  })

  test('an auth failure is not a missing model', () => {
    expect(
      isModelGoneError({ status: 401, message: 'invalid api key' }),
    ).toBe(false)
  })
})
