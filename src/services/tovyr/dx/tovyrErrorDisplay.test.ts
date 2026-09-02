import { describe, expect, test } from 'bun:test'
import { isTovyrErrorDisplayText } from '../../../components/tovyr/TovyrErrorTurn.js'

describe('tovyrErrorDisplay', () => {
  test('detects API error prefix', () => {
    expect(isTovyrErrorDisplayText('API Error: model unavailable')).toBe(true)
  })

  test('detects Request too large error', () => {
    expect(
      isTovyrErrorDisplayText(
        'Request too large (max 20MB). Double press esc to go back and try with a smaller file.',
      ),
    ).toBe(true)
  })

  test('detects context-window errors', () => {
    expect(isTovyrErrorDisplayText('Prompt is too long')).toBe(true)
  })

  test('ignores normal assistant prose', () => {
    expect(
      isTovyrErrorDisplayText('Here is how you can fix the login page.'),
    ).toBe(false)
  })
})
