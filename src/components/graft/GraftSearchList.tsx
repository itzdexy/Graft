import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { truncateToWidth } from '../../utils/format.js'
import {
  clampCursor,
  nextSelectableIndex,
  visibleWindow,
} from '../../services/graft/search/searchListNavigation.js'

/**
 * One row in a search list. Callers build these from whatever domain rows they
 * have; this component only knows how to draw and navigate them.
 */
export type SearchListItem = {
  /** Stable unique id, handed back to `onSelect`. */
  key: string
  /** Primary text. */
  label: string
  /** Dim text after the label — the id, the tier, the context window. */
  detail?: string
  /** Right-aligned status chip: "active", "✓ key", "needs key". */
  badge?: string
  /** Colour for the badge. */
  badgeTone?: 'success' | 'warning' | 'error' | 'accent' | 'muted'
  /** Section heading this row belongs under. */
  group?: string
  /** Rows that cannot be chosen are skipped by the cursor and dimmed. */
  disabled?: boolean
  /** Indices into `label` that matched the query, for highlighting. */
  matchIndices?: number[]
}

type Props = {
  /** Heading, e.g. "Connect a provider". */
  title: string
  /** Already filtered and ranked by the caller. */
  items: readonly SearchListItem[]
  query: string
  onQueryChange: (query: string) => void
  onSelect: (key: string) => void
  onCancel: () => void
  /** Placeholder inside the search field. */
  placeholder?: string
  /** Right-hand counter, e.g. "12 of 308 models". */
  summary?: string
  /** Line under the title — the current state ("Active: Anthropic · Opus 4.5"). */
  status?: React.ReactNode
  /** Error or warning shown above the list. */
  notice?: { text: string; tone: 'error' | 'warning' | 'success' } | null
  /** Rows visible at once before the list scrolls. */
  visibleCount?: number
  /** Shown when `items` is empty. */
  emptyMessage?: string
  /** Extra key hints appended to the footer. */
  footerHint?: string
  /** Row to start the cursor on. */
  initialKey?: string
  /** Suppresses input while a probe is in flight. */
  isDisabled?: boolean
}

const ACCENT = 'graftPrimary'
const DEFAULT_VISIBLE = 12
/** Cursor glyph plus its trailing space. */
const CURSOR_WIDTH = 2
/** Space between the label and the detail column. */
const GUTTER = 2
/**
 * Model names are short; capping the label keeps the detail column aligned
 * across rows instead of ragged.
 */
const LABEL_MAX_WIDTH = 26
/** Control bytes arrive as `input` for keys we already handled by name. */
const CONTROL_CHARS = new RegExp("[\u0000-\u001f\u007f]")

type ThemeColor = 'success' | 'warning' | 'error' | 'subtle' | typeof ACCENT

function badgeColor(tone: SearchListItem['badgeTone']): ThemeColor {
  switch (tone) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    case 'accent':
      return ACCENT
    default:
      return 'subtle'
  }
}

/**
 * Render `label` with the matched characters brightened. Highlighting is what
 * makes a fuzzy result legible — without it "gpt5 → openai/gpt-5" looks like
 * the list ignored the query.
 */
function HighlightedLabel({
  label,
  indices,
  selected,
  dim,
}: {
  label: string
  indices?: number[]
  selected: boolean
  dim?: boolean
}): React.ReactNode {
  const baseColor = dim ? 'subtle' : selected ? ACCENT : 'text'
  if (!indices?.length) {
    return (
      <Text color={baseColor} bold={selected} dimColor={dim}>
        {label}
      </Text>
    )
  }
  const hit = new Set(indices)
  const runs: Array<{ text: string; match: boolean }> = []
  for (let i = 0; i < label.length; i++) {
    const match = hit.has(i)
    const last = runs[runs.length - 1]
    if (last && last.match === match) last.text += label[i]
    else runs.push({ text: label[i]!, match })
  }
  return (
    <Text bold={selected}>
      {runs.map((run, index) => (
        <Text
          key={index}
          color={run.match ? ACCENT : baseColor}
          bold={run.match}
          dimColor={dim && !run.match}
        >
          {run.text}
        </Text>
      ))}
    </Text>
  )
}

/**
 * A search-first list dialog: one always-focused query field above a live
 * filtered list.
 *
 * This replaces the previous approach of embedding a search field as an
 * *option row* inside `Select`. That fought the list for focus — typing a
 * second character moved the cursor to a different row and the rest of the
 * query went to the list as navigation keys. Here the split is unambiguous:
 * printable keys always type, arrows always navigate, Enter always selects.
 */
export function GraftSearchList({
  title,
  items,
  query,
  onQueryChange,
  onSelect,
  onCancel,
  placeholder = 'Type to search…',
  summary,
  status,
  notice,
  visibleCount = DEFAULT_VISIBLE,
  emptyMessage = 'Nothing matches that search.',
  footerHint,
  initialKey,
  isDisabled = false,
}: Props): React.ReactNode {
  const { columns } = useTerminalSize()
  // Use the terminal that is there. An 84-column cap left the detail column
  // truncating tags on a 120-column window for no reason.
  const width = Math.max(40, Math.min(columns - 4, 140))

  const [cursor, setCursor] = useState(() => {
    const start = initialKey ? items.findIndex(i => i.key === initialKey) : -1
    return clampCursor(items, start >= 0 ? start : 0)
  })

  // A new query means a new result set — start at the top match rather than
  // leaving the cursor wherever the previous list happened to put it.
  useEffect(() => {
    setCursor(clampCursor(items, 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query drives this, items follow
  }, [query])

  // Items can change without the query changing (a live model list arrives).
  // Keep the cursor in range without moving it if it is still valid.
  useEffect(() => {
    setCursor(current => clampCursor(items, current))
  }, [items])

  const move = useCallback(
    (delta: number) => {
      setCursor(current => nextSelectableIndex(items, current, delta))
    },
    [items],
  )

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel()
        return
      }
      if (key.return) {
        const item = items[cursor]
        if (item && !item.disabled) onSelect(item.key)
        return
      }
      if (key.upArrow || (key.ctrl && input === 'p')) {
        move(-1)
        return
      }
      if (key.downArrow || (key.ctrl && input === 'n')) {
        move(1)
        return
      }
      if (key.pageUp) {
        move(-visibleCount)
        return
      }
      if (key.pageDown) {
        move(visibleCount)
        return
      }
      if (key.ctrl && input === 'u') {
        onQueryChange('')
        return
      }
      if (key.ctrl && input === 'w') {
        onQueryChange(query.replace(/\S+\s*$/, ''))
        return
      }
      if (key.backspace || key.delete) {
        onQueryChange(query.slice(0, -1))
        return
      }
      // Everything else printable types into the query — spaces included,
      // which is how a two-word query like "claude opus" is entered. Ctrl and
      // meta chords are left alone so global bindings keep working.
      if (!key.ctrl && !key.meta && input && !CONTROL_CHARS.test(input)) {
        onQueryChange(query + input)
      }
    },
    { isActive: !isDisabled },
  )

  const window = useMemo(
    () => visibleWindow(items.length, cursor, visibleCount),
    [items.length, cursor, visibleCount],
  )

  const rows = items.slice(window.from, window.to)
  let lastGroup: string | undefined

  return (
    <Box flexDirection="column" width={width} paddingX={1} gap={1}>
      <Box flexDirection="row">
        <Text bold color={ACCENT}>
          {title}
        </Text>
        <Box flexGrow={1} />
        {summary ? (
          <Text color="subtle" dimColor>
            {summary}
          </Text>
        ) : null}
      </Box>
      {status ? <Box>{status}</Box> : null}

      <Box flexDirection="row">
        <Text color={ACCENT} bold>
          {'❯ '}
        </Text>
        {query ? (
          <Text color="text">{query}</Text>
        ) : (
          <Text color="subtle" dimColor>
            {placeholder}
          </Text>
        )}
        <Text color={ACCENT}>{'▌'}</Text>
      </Box>

      {notice ? (
        <Box>
          <Text color={notice.tone}>{notice.text}</Text>
        </Box>
      ) : null}

      <Box flexDirection="column">
        {rows.length === 0 ? (
          <Text color="subtle" dimColor>
            {emptyMessage}
          </Text>
        ) : (
          rows.map((item, offset) => {
            const index = window.from + offset
            const selected = index === cursor
            const showGroup = item.group && item.group !== lastGroup
            lastGroup = item.group ?? lastGroup
            const badge = item.badge ?? ''
            const detail = item.detail ?? ''
            // One line holds cursor + label + detail + badge. The detail
            // carries the qualified id and the FREE/$/M/TOOLS/ctx tags, which
            // are the whole reason to read the row — a fixed 34-column cap
            // truncated them to "openrouter/stealth/ox-alpha · FRE…" on every
            // terminal. Give the label a bounded share and let the detail take
            // whatever is actually left.
            const labelWidth = Math.max(
              10,
              Math.min(item.label.length, LABEL_MAX_WIDTH),
            )
            const detailWidth = Math.max(
              0,
              width - CURSOR_WIDTH - labelWidth - GUTTER - badge.length - 1,
            )
            return (
              <Box key={item.key} flexDirection="column">
                {showGroup ? (
                  <Box marginTop={offset === 0 ? 0 : 1}>
                    <Text color="subtle" dimColor bold>
                      {item.group}
                    </Text>
                  </Box>
                ) : null}
                <Box flexDirection="row">
                  <Text color={selected ? ACCENT : 'subtle'} bold={selected}>
                    {selected ? '❯ ' : '  '}
                  </Text>
                  <HighlightedLabel
                    label={truncateToWidth(item.label, labelWidth)}
                    indices={item.matchIndices}
                    selected={selected}
                    dim={item.disabled}
                  />
                  {detail && detailWidth > 6 ? (
                    <Text color="subtle" dimColor>
                      {`  ${truncateToWidth(detail, detailWidth)}`}
                    </Text>
                  ) : null}
                  <Box flexGrow={1} />
                  {badge ? (
                    <Text color={badgeColor(item.badgeTone)} dimColor={!selected}>
                      {badge}
                    </Text>
                  ) : null}
                </Box>
              </Box>
            )
          })
        )}
      </Box>

      <Box flexDirection="row">
        <Text color="subtle" dimColor>
          <Text color={ACCENT} bold>
            ↑↓
          </Text>
          {' move · '}
          <Text color={ACCENT} bold>
            ↵
          </Text>
          {' select · '}
          <Text color={ACCENT} bold>
            esc
          </Text>
          {' close'}
          {footerHint ? ` · ${footerHint}` : ''}
        </Text>
        <Box flexGrow={1} />
        {items.length > visibleCount ? (
          <Text color="subtle" dimColor>
            {`${Math.min(cursor + 1, items.length)}/${items.length}`}
          </Text>
        ) : null}
      </Box>
    </Box>
  )
}
