import { accessSync, constants, statSync } from 'node:fs'
import path from 'node:path'

/** Resolve only explicit absolute PATH entries, never an implicit current directory. */
export function findSystemRipgrep(pathValue = process.env.PATH ?? '', platform = process.platform) {
  const paths = platform === 'win32' ? path.win32 : path.posix
  const executable = platform === 'win32' ? 'rg.exe' : 'rg'
  for (const raw of pathValue.split(platform === 'win32' ? ';' : ':')) {
    const directory = raw.trim().replace(/^"(.*)"$/, '$1')
    if (!paths.isAbsolute(directory)) continue
    const candidate = paths.join(directory, executable)
    try {
      if (!statSync(candidate).isFile()) continue
      accessSync(candidate, platform === 'win32' ? constants.F_OK : constants.X_OK)
      return candidate
    } catch { /* Try the next explicit PATH entry. */ }
  }
  return null
}
