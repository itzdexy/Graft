import { describe, expect, test } from 'bun:test'
import { isGraftErrorDisplayText } from '../../../components/graft/GraftErrorTurn.js'

describe('graftErrorDisplay', () => {
  test('detects API error prefix', () => {
    expect(isGraftErrorDisplayText('API Error: model unavailable')).toBe(true)
  })

  test('detects Request too large error', () => {
    expect(
      isGraftErrorDisplayText(
        'Request too large (max 20MB). Double press esc to go back and try with a smaller file.',
      ),
    ).toBe(true)
  })

  test('detects context-window errors', () => {
    expect(isGraftErrorDisplayText('Prompt is too long')).toBe(true)
  })

  test('ignores normal assistant prose', () => {
    expect(
      isGraftErrorDisplayText('Here is how you can fix the login page.'),
    ).toBe(false)
  })
})
