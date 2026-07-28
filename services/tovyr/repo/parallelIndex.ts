import { readFile } from 'fs/promises'
import { join } from 'path'
import { buildRepoIndex, type IndexFileFn } from './indexer.js'
import type { RepoIndex } from './types.js'

const PARALLEL_READS = 32

/** Read tracked files in parallel batches, then build index. */
export async function buildRepoIndexParallel(
  cwd: string,
  filePaths: string[],
): Promise<RepoIndex> {
  const contents = new Map<string, string>()

  for (let i = 0; i < filePaths.length; i += PARALLEL_READS) {
    const batch = filePaths.slice(i, i + PARALLEL_READS)
    await Promise.all(
      batch.map(async rel => {
        try {
          const text = await readFile(join(cwd, rel), 'utf8')
          contents.set(rel, text)
        } catch {
          // skip unreadable
        }
      }),
    )
  }

  const syncRead: IndexFileFn = rel => contents.get(rel) ?? null
  return buildRepoIndex(cwd, filePaths, syncRead)
}
