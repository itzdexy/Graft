import { describe, expect, test } from 'bun:test'
import { formatModeStatus, resolveGraftTurnPermissionMode } from './modes.js'

describe('resolveGraftTurnPermissionMode', () => {
  test('uses the newest user turn override for the request tool context', () => {
    expect(
      resolveGraftTurnPermissionMode(
        [
          { type: 'user', permissionMode: 'acceptEdits' },
          { type: 'system' },
          { type: 'user', permissionMode: 'plan' },
        ],
        'acceptEdits',
      ),
    ).toBe('plan')
  })

  test('falls back to the live mode when the turn has no override', () => {
    expect(
      resolveGraftTurnPermissionMode([{ type: 'system' }], 'acceptEdits'),
    ).toBe('acceptEdits')
  })

  test('advertises classifier-guarded auto mode separately from bypass', () => {
    const status = formatModeStatus(() => ({
      toolPermissionContext: { mode: 'default' },
    }) as never)

    expect(status).toContain('/auto')
    expect(status).toContain('classifier')
    expect(status).toContain('/bypass')
  })
})
