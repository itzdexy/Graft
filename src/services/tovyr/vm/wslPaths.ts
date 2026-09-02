/**
 * Path and distro handling for the WSL-backed VM.
 *
 * Pure so it can be tested without a WSL install — the exec layer around it
 * cannot be, and path translation is where this kind of integration usually
 * breaks (drive letters, UNC roots, already-Linux paths passed through twice).
 */

export type WslDistro = {
  name: string
  state: string
  version: number
  isDefault: boolean
}

/**
 * Parse `wsl.exe -l -v`.
 *
 * The output is UTF-16LE, so callers must decode it first; after decoding it
 * still carries stray NULs on some Windows builds. `*` marks the default
 * distro and is not part of the name.
 */
export function parseWslDistros(raw: string): WslDistro[] {
  const cleaned = raw.replace(/\0/g, '')
  const lines = cleaned.split(/\r?\n/).slice(1) // drop the header row
  const distros: WslDistro[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const isDefault = trimmed.startsWith('*')
    const body = (isDefault ? trimmed.slice(1) : trimmed).trim()
    const parts = body.split(/\s+/)
    if (parts.length < 3) continue

    const version = Number(parts[parts.length - 1])
    const state = parts[parts.length - 2] ?? ''
    const name = parts.slice(0, parts.length - 2).join(' ')
    if (!name || !Number.isFinite(version)) continue

    distros.push({ name, state, version, isDefault })
  }

  return distros
}

/** The distro a bare `wsl.exe` command would use. */
export function defaultDistro(distros: WslDistro[]): WslDistro | null {
  return distros.find(d => d.isDefault) ?? distros[0] ?? null
}

/**
 * Translate a Windows path to its WSL mount point.
 *
 * `C:\Users\me\proj` becomes `/mnt/c/Users/me/proj`. A path that is already
 * POSIX is returned unchanged — running this twice must not corrupt it, which
 * is easy to do when a caller cannot tell which form it holds.
 */
export function toWslPath(windowsPath: string): string {
  const value = windowsPath.trim()
  if (!value) return value

  // Already a Linux path.
  if (value.startsWith('/')) return value

  // UNC paths have no drive letter and no mount point.
  if (value.startsWith('\\\\')) {
    throw new Error(`UNC paths are not reachable from WSL: ${windowsPath}`)
  }

  const match = value.match(/^([A-Za-z]):[\\/](.*)$/)
  if (!match) {
    // A relative path is meaningful only against a cwd the caller must resolve
    // first; silently guessing would put files somewhere unexpected.
    throw new Error(
      `Expected an absolute Windows path, got: ${windowsPath}`,
    )
  }

  const drive = (match[1] ?? '').toLowerCase()
  const rest = (match[2] ?? '').replace(/\\/g, '/')
  return `/mnt/${drive}${rest ? `/${rest}` : ''}`
}

/**
 * Quote a string for `bash -lc`.
 *
 * Single quotes with the standard `'\''` escape: inside single quotes bash
 * treats everything literally, so this is safe for arbitrary agent-authored
 * commands including ones containing `$`, backticks or newlines.
 */
export function quoteForBash(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
