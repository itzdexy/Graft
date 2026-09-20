import { opendir, stat } from 'node:fs/promises'

/** Called only after Read's permission check. Never follows child symlinks. */
export async function readDirectoryAsText(filePath: string, signal?: AbortSignal): Promise<string | null> {
  signal?.throwIfAborted()
  if (!(await stat(filePath)).isDirectory()) return null
  const names: string[] = []
  let truncated = false
  for await (const entry of await opendir(filePath)) {
    signal?.throwIfAborted()
    if (names.length === 200) { truncated = true; break }
    const kind = entry.isDirectory() ? 'folder' : entry.isSymbolicLink() ? 'link' : 'file'
    names.push(`${kind}  ${JSON.stringify(entry.name)}`)
  }
  names.sort()
  return [
    'Directory listing (immediate children only; file contents have not been read):',
    ...(names.length ? names : ['This folder is empty.']),
    ...(truncated ? ['Listing limited to 200 entries. Use Glob with a narrower pattern to find more.'] : []),
  ].join('\n')
}
