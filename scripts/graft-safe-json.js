/**
 * Resilient JSON config IO for Graft's startup path.
 *
 * Graft rewrites large config files (~/.graft.json, ~/.graft/settings.json,
 * ~/.graft/*) on every launch. Those writes are not atomic, so a Ctrl-C or
 * crash mid-write can truncate a file and leave invalid JSON on disk. An
 * unguarded JSON.parse then throws a raw SyntaxError and bricks every
 * subsequent launch until the user manually deletes the file.
 *
 * readJsonSafe() degrades to a caller-supplied fallback instead of throwing,
 * and preserves the corrupt file as a .corrupt-<ts>.bak so nothing is lost.
 * writeJsonAtomic() writes to a temp sibling then renames, so an interrupted
 * write can never truncate the live file.
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  copyFileSync,
  unlinkSync,
} from 'fs'

/**
 * Read and parse JSON, returning `fallback` when the file is missing,
 * unreadable, or contains invalid JSON. A corrupt file is backed up once.
 *
 * @template T
 * @param {string} path
 * @param {T} [fallback]
 * @returns {T}
 */
export function readJsonSafe(path, fallback = {}) {
  if (!existsSync(path)) return fallback
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return fallback
  }
  // An empty file is common after an interrupted write — treat as fallback
  // without noise.
  if (!raw.trim()) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    backupCorruptFile(path)
    return fallback
  }
}

/** Move a corrupt config aside so a fresh one can be written cleanly. */
function backupCorruptFile(path) {
  try {
    const backup = `${path}.corrupt-${Date.now()}.bak`
    copyFileSync(path, backup)
  } catch {
    // Best-effort only; never let backup failure block startup.
  }
}

/**
 * Atomically write pretty-printed JSON. Falls back to a direct write if the
 * temp-and-rename path fails (e.g. antivirus locks on Windows).
 *
 * @param {string} path
 * @param {unknown} value
 * @param {{ mode?: number }} [options] - optional file mode (e.g. 0o600 for secrets)
 * @returns {string} the path written
 */
export function writeJsonAtomic(path, value, options = {}) {
  const data = JSON.stringify(value, null, 2)
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  const writeOpts = options.mode ? { mode: options.mode } : undefined
  try {
    writeFileSync(tmp, data, writeOpts)
    renameSync(tmp, path)
  } catch {
    try {
      if (existsSync(tmp)) unlinkSync(tmp)
    } catch {
      // ignore
    }
    writeFileSync(path, data, writeOpts)
  }
  return path
}
