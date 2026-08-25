import os from 'node:os'

/** Cross-platform user home (~/.kairo, ~/.claude). */
export function getTovyrHome() {
  return process.env.TOVYR_HOME || process.env.HOME || process.env.USERPROFILE || os.homedir() || ''
}

export function platformLabel() {
  switch (process.platform) {
    case 'darwin':
      return 'macOS'
    case 'linux':
      return 'Linux'
    case 'win32':
      return 'Windows'
    default:
      return process.platform
  }
}
