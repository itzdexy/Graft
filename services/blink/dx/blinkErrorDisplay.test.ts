import { describe, expect, test } from 'bun:test'
import { isBlinkErrorDisplayText } from '../../../components/blink/BlinkErrorTurn.js'

describe('blinkErrorDisplay', () => {
  test('detects API error prefix', () => {
    expect(isBlinkErrorDisplayText('API Error: model unavailable')).toBe(true)
  })

  test('detects Request too large error', () => {
    expect(
      isBlinkErrorDisplayText(
        'Request too large (max 20MB). Double press esc to go back and try with a smaller file.',
      ),
    ).toBe(true)
  })

  test('ignores normal assistant prose', () => {
    expect(
      isBlinkErrorDisplayText('Here is how you can fix the login page.'),
    ).toBe(false)
  })
})
