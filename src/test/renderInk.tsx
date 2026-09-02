/**
 * Render an Ink component to a plain string for assertions.
 *
 * Every defect found on 2026-08-24 was invisible to both `tsc` and the unit
 * suite: four finished components with zero call sites, and props that were
 * computed and then dropped at the call site. An unmounted export and an
 * unpassed optional prop are both valid TypeScript, so the only thing that can
 * catch them is actually drawing the UI and looking at the output.
 *
 * Ink writes escape sequences to a stream; this swaps in a fake stream, lets
 * the tree paint, and hands back what a terminal would have shown.
 */
import * as React from 'react'
import { PassThrough } from 'node:stream'
import type { ReactNode } from 'react'
import { render } from '../ink.js'
import instances from '../ink/instances.js'
import { charInCellAt } from '../ink/screen.js'
import { AppStateProvider } from '../state/AppState.js'

/**
 * Strip SGR/CSI sequences so assertions match on text, not on styling.
 *
 * Cursor-forward (`CSI n C`) is expanded to spaces rather than deleted. Ink
 * pads with cursor motion instead of literal spaces, so dropping it silently
 * welds words together — "first line" came back as "firstline", which would
 * make every toContain assertion on multi-word UI text fail for a reason that
 * has nothing to do with the component under test.
 */
export function stripAnsi(value: string): string {
  return (
    value
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI is the point
      .replace(/\u001B\[(\d*)C/g, (_m, n: string) => ' '.repeat(Number(n) || 1))
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI is the point
      .replace(/\u001B\][^\u0007]*\u0007/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI is the point
      .replace(/\u001B\[[0-9;?]*[A-Za-z]/g, '')
  )
}

type FakeStdout = NodeJS.WriteStream & { frames: string[] }
type FakeStdin = PassThrough & {
  isTTY: boolean
  setRawMode: (enabled: boolean) => FakeStdin
  ref: () => FakeStdin
  unref: () => FakeStdin
}

function fakeStdout(columns: number, rows: number): FakeStdout {
  const frames: string[] = []
  const stream = {
    frames,
    columns,
    rows,
    isTTY: false,
    write: (chunk: unknown) => {
      frames.push(String(chunk))
      return true
    },
    on: () => stream,
    off: () => stream,
    once: () => stream,
    removeListener: () => stream,
    emit: () => false,
    end: () => stream,
  } as unknown as FakeStdout
  return stream
}

function fakeStdin(): FakeStdin {
  const stream = new PassThrough() as FakeStdin
  stream.isTTY = true
  stream.setRawMode = () => stream
  stream.ref = () => stream
  stream.unref = () => stream
  return stream
}

export type RenderResult = {
  /** Everything painted, ANSI stripped and cursor padding restored. */
  output: string
  /** Raw frames, for assertions about colour. */
  raw: string
  /** The last frame containing visible terminal content. */
  lastFrame: string
}

const MAX_DIMENSION = 1000

function normalizeDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(MAX_DIMENSION, Math.floor(value as number)))
}

function finalFrame(stdout: FakeStdout, raw: string, columns: number, rows: number): string {
  const ink = instances.get(stdout)
  const screen = (ink as unknown as { frontFrame?: { screen?: Parameters<typeof charInCellAt>[0] } } | undefined)?.frontFrame?.screen
  if (!screen) return stripAnsi(raw)
  const width = Math.min(columns, screen.width)
  const height = Math.min(rows, screen.height)
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => charInCellAt(screen, x, y) ?? '').join('').trimEnd(),
  ).join('\n').trimEnd()
}

/**
 * Mount `node`, let effects settle, and return what was painted.
 *
 * `withAppState` wraps the tree in an AppStateProvider. Anything that renders
 * Markdown needs it — Markdown calls useAppState and throws a ReferenceError
 * without a provider, which surfaces as Ink painting a red error box instead
 * of your component. Left off by default so a leaf component under test is not
 * silently given machinery it does not actually depend on.
 */
export async function renderToText(
  node: ReactNode,
  options: {
    columns?: number
    rows?: number
    settleMs?: number
    withAppState?: boolean
    env?: Record<string, string | undefined>
    renderImpl?: typeof render
    /** Send input after the first paint, before the final frame is captured. */
    interact?: (stdin: FakeStdin) => void | Promise<void>
  } = {},
): Promise<RenderResult> {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(options.env ?? {})) {
    previous.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  const columns = normalizeDimension(options.columns, 100)
  const rows = normalizeDimension(options.rows, 40)
  const stdout = fakeStdout(columns, rows)
  const stdin = fakeStdin()
  const tree = options.withAppState
    ? React.createElement(AppStateProvider, null, node)
    : node
  let instance: { unmount?: () => void; cleanup?: () => void } | undefined
  try {
    instance = await (options.renderImpl ?? render)(tree as never, {
      stdout,
      stdin,
      patchConsole: false,
      exitOnCtrlC: false,
    } as never)

    // Let mount effects and the first paint flush.
    await new Promise(resolve => setTimeout(resolve, Math.max(0, options.settleMs ?? 60)))
    await options.interact?.(stdin)
    // Let input handlers commit state and repaint before reading the screen.
    await new Promise(resolve => setTimeout(resolve, Math.max(0, options.settleMs ?? 60)))

    const raw = stdout.frames.join('')
    return {
      output: stripAnsi(raw),
      raw,
      lastFrame: finalFrame(stdout, raw, columns, rows),
    }
  } finally {
    try {
      try {
        instance?.unmount?.()
      } catch {
        // Unmount failures must not mask the assertion being made.
      } finally {
        instance?.cleanup?.()
        stdin.end()
      }
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  }
}
