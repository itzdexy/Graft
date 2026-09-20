import { describe, expect, test } from 'bun:test'
import { isPolicyOnlyDenial } from './pathDenialReason.js'

/**
 * The Graft path validator runs AFTER the permission system has decided and,
 * where the mode requires it, already asked the user. Anything it re-decides
 * here overrides that answer with an unappealable error.
 *
 * Policy denials (rule / mode / workingDir) must therefore defer. Path-safety
 * denials must keep failing closed regardless of what any prompt said —
 * a user approving "write this file" is not approval to follow a UNC path or
 * clobber a credentials file.
 */
describe('isPolicyOnlyDenial', () => {
  test('permission policy defers to the permission system', () => {
    expect(
      isPolicyOnlyDenial({
        type: 'rule',
        rule: {
          source: 'userSettings',
          ruleBehavior: 'deny',
          ruleValue: { toolName: 'Edit' },
        },
      } as never),
    ).toBe(true)
    expect(isPolicyOnlyDenial({ type: 'mode', mode: 'plan' } as never)).toBe(
      true,
    )
    expect(
      isPolicyOnlyDenial({ type: 'workingDir', reason: 'outside' } as never),
    ).toBe(true)
  })

  test('path-safety denials still fail closed', () => {
    // UNC paths, tilde variants and shell expansion all arrive as 'other'.
    expect(
      isPolicyOnlyDenial({
        type: 'other',
        reason: 'UNC network paths require manual approval',
      } as never),
    ).toBe(false)
    // Sensitive/dangerous files.
    expect(
      isPolicyOnlyDenial({
        type: 'safetyCheck',
        reason: 'sensitive file',
      } as never),
    ).toBe(false)
  })

  test('an absent reason fails closed', () => {
    expect(isPolicyOnlyDenial(undefined)).toBe(false)
  })

  test('an unknown variant fails closed', () => {
    expect(isPolicyOnlyDenial({ type: 'brand-new-kind' } as never)).toBe(false)
  })
})
