import { spawn } from 'node:child_process'

/**
 * Best-effort "open this URL in the default browser". Never throws and never
 * blocks — superthink still works if the user opens the printed URL manually.
 */
export function openUrl(url: string): void {
  try {
    const platform = process.platform
    let command: string
    let args: string[]
    if (platform === 'darwin') {
      command = 'open'
      args = [url]
    } else if (platform === 'win32') {
      // `start` is a cmd builtin; the empty "" is the window-title arg.
      command = 'cmd'
      args = ['/c', 'start', '', url]
    } else {
      command = 'xdg-open'
      args = [url]
    }
    const child = spawn(command, args, { stdio: 'ignore', detached: true })
    child.on('error', () => {
      /* opener missing — ignore, user has the URL */
    })
    child.unref()
  } catch {
    // Ignore — opening a browser is a convenience, not a requirement.
  }
}
