import { describe, expect, test } from 'bun:test'
import { describePathDenial } from './pathDenialReason.js'

const FALLBACK = 'Path is not allowed by permission rules.'

/**
 * Every denial variant used to render as FALLBACK, so a rule block, a safety
 * check, and a mode restriction were indistinguishable in the transcript.
 */
describe('describePathDenial', () => {
  test('names the rule and its source', () => {
    const message = describePathDenial({
      type: 'rule',
      rule: {
        source: 'projectSettings',
        ruleBehavior: 'deny',
        ruleValue: { toolName: 'Edit', ruleContent: '**/*.config.js' },
      },
    } as never)
    expect(message).toContain('Edit(**/*.config.js)')
    expect(message).toContain('projectSettings')
    expect(message).toContain('/permissions')
    expect(message).not.toBe(FALLBACK)
  })

  test('names the mode and how to change it', () => {
    const message = describePathDenial({ type: 'mode', mode: 'plan' } as never)
    expect(message).toContain('plan')
    expect(message).toContain('shift+tab')
  })

  test('passes through a safety check reason', () => {
    const message = describePathDenial({
      type: 'safetyCheck',
      reason: 'that file is sensitive',
    } as never)
    expect(message).toBe('that file is sensitive')
  })

  test('names the hook that blocked it', () => {
    expect(
      describePathDenial({ type: 'hook', hookName: 'PreToolUse' } as never),
    ).toContain('PreToolUse')
    expect(
      describePathDenial({
        type: 'hook',
        hookName: 'PreToolUse',
        reason: 'no writes during review',
      } as never),
    ).toContain('no writes during review')
  })

  test('handles a rule with no ruleContent', () => {
    const message = describePathDenial({
      type: 'rule',
      rule: {
        source: 'userSettings',
        ruleBehavior: 'deny',
        ruleValue: { toolName: 'Write' },
      },
    } as never)
    expect(message).toContain('Write')
    expect(message).not.toContain('undefined')
  })

  test('falls back when there is no reason at all', () => {
    expect(describePathDenial(undefined)).toBe(FALLBACK)
  })

  test('falls back on an unknown variant rather than throwing', () => {
    expect(describePathDenial({ type: 'not-a-real-type' } as never)).toBe(
      FALLBACK,
    )
  })

  test('falls back when a reason field is empty', () => {
    expect(describePathDenial({ type: 'other', reason: '' } as never)).toBe(
      FALLBACK,
    )
  })
})
