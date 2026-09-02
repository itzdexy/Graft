/**
 * Recoverable deletion.
 *
 * Until now the only way for the agent to delete a file was to shell out to
 * `rm` (or `Remove-Item`), which is immediate and irreversible, and which
 * behaves differently depending on whether Bash or PowerShell answered. Moving
 * to a trash directory instead means a wrong delete costs a `mv` to undo
 * rather than the file.
 *
 * Not a general-purpose trash: it is per session and never emptied
 * automatically, so a user who wants the space back removes the directory.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { getTovyrHome } from '../../../scripts/tovyr-home.js'

export function trashRoot(sessionId: string): string {
  // Sanitised: sessionId reaches the filesystem as a directory name.
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, '') || 'session'
  return join(getTovyrHome(), '.tovyr', 'trash', safe)
}

/**
 * Move `path` into the session's trash, returning where it landed.
 *
 * Collisions are resolved by suffixing rather than overwriting: deleting two
 * files named `index.ts` from different directories must not have the second
 * destroy the first's only copy.
 */
export function moveToTrash(path: string, sessionId: string): string {
  const source = resolve(path)
  if (!existsSync(source)) {
    throw new Error(`Cannot delete: ${source} does not exist`)
  }

  const root = trashRoot(sessionId)
  mkdirSync(root, { recursive: true })

  const name = basename(source)
  let destination = join(root, name)
  let counter = 1
  while (existsSync(destination)) {
    destination = join(root, `${name}.${counter}`)
    counter += 1
  }

  try {
    renameSync(source, destination)
  } catch {
    // rename() fails across devices (EXDEV), which is the normal case when the
    // workspace and the Tovyr home are on different drives -- a routine setup
    // on Windows. Fall back to copy-then-remove.
    const stats = statSync(source)
    if (stats.isDirectory()) {
      cpDirSync(source, destination)
    } else {
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(source, destination)
    }
    rmSync(source, { recursive: true, force: true })
  }
  return destination
}

function cpDirSync(from: string, to: string): void {
  // node:fs cpSync exists but is still marked experimental on the Node
  // versions this package supports (>=18), so do it by hand.
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name)
    const dst = join(to, entry.name)
    if (entry.isDirectory()) cpDirSync(src, dst)
    else copyFileSync(src, dst)
  }
}
