import { describe, expect, test } from 'bun:test'
import { fitKeyHints, type KeyHint } from './TovyrKeyHintBar.js'

const hints: KeyHint[] = [
  { keys: 'ctrl+p', action: 'commands' }, // 15
  { keys: 'shift+tab', action: 'mode' }, // 14 (+2 gap)
  { keys: '?', action: 'help' }, // 6 (+2 gap)
]

describe('fitKeyHints', () => {
  test('shows every hint when the row is wide', () => {
    expect(fitKeyHints(200, hints)).toEqual(hints)
  })

  test('drops the least-used hints first as the row narrows', () => {
    expect(fitKeyHints(15, hints)).toEqual([hints[0]!])
    expect(fitKeyHints(31, hints)).toEqual([hints[0]!, hints[1]!])
  })

  test('renders nothing rather than a clipped hint on a tiny row', () => {
    expect(fitKeyHints(0, hints)).toEqual([])
    expect(fitKeyHints(14, hints)).toEqual([])
  })

  test('never advertises a shortcut the help overlay does not list', () => {
    // Guards against drift between the rail and the real bindings.
    const documented = new Set(['ctrl+p', 'shift+tab', '?', 'tab', 'ctrl+o', 'esc'])
    for (const hint of fitKeyHints(200)) {
      expect(documented.has(hint.keys)).toBe(true)
    }
  })
})
