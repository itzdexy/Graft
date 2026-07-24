/**
 * Crash-safe JSON writes for Blink's own persistent state (agent sessions,
 * project memory, etc.).
 *
 * These files are rewritten frequently — on every agent step and every
 * remembered fact. A plain writeFileSync truncates the target before writing,
 * so a Ctrl-C or crash mid-write leaves an empty/partial file and silently
 * destroys the accumulated session or memory. Writing to a temp sibling and
 * renaming makes the swap atomic: readers ever see either the old file or the
 * complete new one, never a truncated one.
 */
import { existsSync, renameSync, unlinkSync, writeFileSync } from 'fs'

export type AtomicWriteOptions = {
  /** File mode for the final file (e.g. 0o600 for secrets). */
  mode?: number
}

/** Atomically write pretty-printed JSON, falling back to a direct write. */
export function writeJsonAtomic(
  path: string,
  value: unknown,
  options: AtomicWriteOptions = {},
): void {
  const data = JSON.stringify(value, null, 2)
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  try {
    writeFileSync(tmp, data, options.mode ? { mode: options.mode } : undefined)
    renameSync(tmp, path)
  } catch {
    try {
      if (existsSync(tmp)) unlinkSync(tmp)
    } catch {
      // ignore cleanup failure
    }
    writeFileSync(path, data, options.mode ? { mode: options.mode } : undefined)
  }
}
