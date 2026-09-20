/**
 * Cursor and viewport arithmetic for `GraftSearchList`.
 *
 * Split out from the component so the fiddly parts — skipping disabled group
 * rows, clamping after a filter shrinks the list, keeping the selection inside
 * the scroll window — are testable without rendering a terminal.
 */

export type NavigableRow = {
  /** Disabled rows are drawn but never receive the cursor. */
  disabled?: boolean
}

/** First selectable index at or after `from`, or -1 when none exists. */
function firstSelectableFrom(
  items: readonly NavigableRow[],
  from: number,
  direction: 1 | -1,
): number {
  for (
    let index = from;
    index >= 0 && index < items.length;
    index += direction
  ) {
    if (!items[index]?.disabled) return index
  }
  return -1
}

/**
 * Snap `desired` onto a selectable row inside the current list.
 *
 * Searches forward first (a filter usually removes rows *above* the old
 * cursor), then backward, then gives up with 0 so the cursor is never
 * left pointing past the end.
 */
export function clampCursor(
  items: readonly NavigableRow[],
  desired: number,
): number {
  if (items.length === 0) return 0
  const start = Math.max(0, Math.min(desired, items.length - 1))
  const forward = firstSelectableFrom(items, start, 1)
  if (forward !== -1) return forward
  const backward = firstSelectableFrom(items, start, -1)
  return backward !== -1 ? backward : 0
}

/**
 * Move the cursor by `delta` rows, skipping disabled ones and wrapping at the
 * ends — wrapping is what makes a 300-row model list navigable without
 * holding a key down.
 */
export function nextSelectableIndex(
  items: readonly NavigableRow[],
  current: number,
  delta: number,
): number {
  if (items.length === 0) return 0
  if (delta === 0) return clampCursor(items, current)

  const direction: 1 | -1 = delta > 0 ? 1 : -1
  const steps = Math.abs(delta)
  let index = current

  for (let step = 0; step < steps; step++) {
    let candidate = index
    // Walk at least one row, then keep walking while we land on a header.
    for (let guard = 0; guard < items.length; guard++) {
      candidate += direction
      if (candidate >= items.length) candidate = 0
      else if (candidate < 0) candidate = items.length - 1
      if (!items[candidate]?.disabled) break
    }
    if (items[candidate]?.disabled) return clampCursor(items, current)
    index = candidate
  }

  return index
}

export type ListWindow = {
  /** Inclusive start index. */
  from: number
  /** Exclusive end index. */
  to: number
}

/**
 * The slice of rows to draw so that `cursor` stays visible.
 *
 * Scrolls the minimum distance needed rather than re-centring, so the list
 * does not jump under the user while they arrow through it.
 */
export function visibleWindow(
  total: number,
  cursor: number,
  size: number,
): ListWindow {
  const capped = Math.max(1, Math.min(size, total))
  if (total <= capped) return { from: 0, to: total }

  let from = Math.max(0, Math.min(cursor - Math.floor(capped / 2), total - capped))
  from = Math.max(0, Math.min(from, cursor))
  if (cursor >= from + capped) from = cursor - capped + 1
  return { from, to: from + capped }
}
