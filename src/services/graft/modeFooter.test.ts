import { describe, expect, test } from 'bun:test'
import { resolveGraftFooterModeChips } from './modeFooter.js'

describe('modeFooter', () => {
  test('marks the active permission mode chip for the prompt footer badge', () => {
    expect(
      resolveGraftFooterModeChips('plan', false, 'prompt').map(chip => ({
        label: chip.label,
        active: chip.isActive,
      })),
    ).toEqual([{ label: 'plan', active: true }])

    expect(
      resolveGraftFooterModeChips('acceptEdits', false, 'prompt').map(
        chip => ({
          label: chip.label,
          active: chip.isActive,
        }),
      ),
    ).toEqual([{ label: 'code', active: true }])

    expect(
      resolveGraftFooterModeChips('bypassPermissions', false, 'prompt').map(
        chip => ({
          label: chip.label,
          active: chip.isActive,
        }),
      ),
    ).toEqual([{ label: 'bypass', active: true }])
  })

  test('keeps auxiliary mode chips visible next to the active mode', () => {
    const chips = resolveGraftFooterModeChips(
      'acceptEdits',
      true,
      'prompt',
      true,
    )

    expect(chips.map(chip => chip.label)).toEqual([
      'superthink·on',
      'crush',
      'code',
    ])
    expect(chips.filter(chip => chip.isActive).map(chip => chip.label)).toEqual([
      'code',
    ])
  })

  test('shows bash as the active chip in bash input mode', () => {
    expect(
      resolveGraftFooterModeChips('acceptEdits', false, 'bash').map(chip => ({
        label: chip.label,
        active: chip.isActive,
      })),
    ).toEqual([{ label: 'bash', active: true }])
  })
})
