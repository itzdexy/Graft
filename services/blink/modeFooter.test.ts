import { describe, expect, test } from 'bun:test'
import { resolveBlinkFooterModeChips } from './modeFooter.js'

describe('modeFooter', () => {
  test('marks the active permission mode chip for the prompt footer badge', () => {
    expect(
      resolveBlinkFooterModeChips('plan', false, 'prompt').map(chip => ({
        label: chip.label,
        active: chip.isActive,
      })),
    ).toEqual([{ label: 'plan', active: true }])

    expect(
      resolveBlinkFooterModeChips('acceptEdits', false, 'prompt').map(
        chip => ({
          label: chip.label,
          active: chip.isActive,
        }),
      ),
    ).toEqual([{ label: 'code', active: true }])

    expect(
      resolveBlinkFooterModeChips('bypassPermissions', false, 'prompt').map(
        chip => ({
          label: chip.label,
          active: chip.isActive,
        }),
      ),
    ).toEqual([{ label: 'bypass', active: true }])
  })

  test('keeps auxiliary mode chips visible next to the active mode', () => {
    const chips = resolveBlinkFooterModeChips(
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
      resolveBlinkFooterModeChips('acceptEdits', false, 'bash').map(chip => ({
        label: chip.label,
        active: chip.isActive,
      })),
    ).toEqual([{ label: 'bash', active: true }])
  })
})
