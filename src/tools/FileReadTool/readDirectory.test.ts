import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readDirectoryAsText } from './readDirectory.js'

test('Read handles folders with spaces, empty folders, files and cancellation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'graft-folder-read-'))
  try {
    const folder = join(root, 'New folder')
    await mkdir(folder)
    expect(await readDirectoryAsText(folder)).toContain('This folder is empty.')
    await writeFile(join(folder, 'readme.txt'), 'private contents not included')
    await mkdir(join(folder, 'nested'))
    const listing = await readDirectoryAsText(folder)
    expect(listing).toContain('file  "readme.txt"')
    expect(listing).toContain('folder  "nested"')
    expect(listing).not.toContain('private contents')
    expect(await readDirectoryAsText(join(folder, 'readme.txt'))).toBeNull()
    await expect(readDirectoryAsText(folder, AbortSignal.abort())).rejects.toThrow()
    await Promise.all(Array.from({length: 201}, (_, n) => writeFile(join(folder, `${n}.txt`), '')))
    expect(await readDirectoryAsText(folder)).toContain('Listing limited to 200 entries')
  } finally { await rm(root, { recursive: true, force: true }) }
})
