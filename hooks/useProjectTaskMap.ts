import { useEffect, useMemo, useState } from 'react'
import { readRepoIndexCache } from '../services/blink/repo/cache.js'
import {
  buildTaskProjectMap,
  type TaskProjectMap,
} from '../services/blink/repo/taskRelevance.js'

const POLL_MS = 2_000

/**
 * Reactive project map from cached repo index + current task query.
 * Polls until the background index appears (warmRepoMapCache).
 */
export function useProjectTaskMap(
  cwd: string,
  taskQuery?: string,
  seedPaths?: string[],
): TaskProjectMap {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setRevision(v => v + 1), POLL_MS)
    return () => clearInterval(timer)
  }, [cwd])

  return useMemo(() => {
    const index = readRepoIndexCache(cwd)
    return buildTaskProjectMap(index, {
      query: taskQuery,
      seedPaths,
      maxFiles: 12,
      maxEdges: 5,
    })
  }, [cwd, taskQuery, seedPaths?.join('|'), revision])
}
