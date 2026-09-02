import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SessionKind, SessionStatus } from './concurrentSessions.js'
import { getTovyrConfigHomeDir } from './envUtils.js'
import { isProcessRunning } from './genericProcessUtils.js'
import { jsonParse } from './slowOperations.js'

export type SessionRegistryRecord = {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  updatedAt?: number
  kind: SessionKind
  name?: string
  status?: SessionStatus
  messagingSocketPath?: string
}

export type SessionPeer = {
  pid: number
  sessionId: string
  cwd: string
  kind: SessionKind
  address: string
  name?: string
  status?: SessionStatus
  updatedAt?: number
}

export function projectLiveSessionPeers(
  records: readonly SessionRegistryRecord[],
  options: {
    currentPid?: number
    isProcessRunning?: (pid: number) => boolean
  } = {},
): SessionPeer[] {
  const currentPid = options.currentPid ?? process.pid
  const alive = options.isProcessRunning ?? isProcessRunning
  return records
    .filter(
      record =>
        record.pid !== currentPid &&
        Boolean(record.messagingSocketPath) &&
        alive(record.pid),
    )
    .map(record => ({
      pid: record.pid,
      sessionId: record.sessionId,
      cwd: record.cwd,
      kind: record.kind,
      address: `uds:${record.messagingSocketPath}`,
      ...(record.name ? { name: record.name } : {}),
      ...(record.status ? { status: record.status } : {}),
      ...(record.updatedAt !== undefined
        ? { updatedAt: record.updatedAt }
        : {}),
    }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

async function readSessionRegistryRecords(): Promise<SessionRegistryRecord[]> {
  const directory = join(getTovyrConfigHomeDir(), 'sessions')
  const filenames = await readdir(directory).catch(() => [] as string[])
  const records: SessionRegistryRecord[] = []
  for (const filename of filenames) {
    if (!/^\d+\.json$/.test(filename)) continue
    try {
      const value = jsonParse(
        await readFile(join(directory, filename), 'utf8'),
      ) as SessionRegistryRecord
      if (
        typeof value.pid === 'number' &&
        typeof value.sessionId === 'string' &&
        typeof value.cwd === 'string' &&
        typeof value.startedAt === 'number'
      ) {
        records.push(value)
      }
    } catch {
      // A concurrently rewritten or stale record is simply not a live peer.
    }
  }
  return records
}

export async function listAllLiveSessions(): Promise<SessionRegistryRecord[]> {
  const records = await readSessionRegistryRecords()
  return records.filter(record => isProcessRunning(record.pid))
}

export async function listSessionPeers(): Promise<SessionPeer[]> {
  return projectLiveSessionPeers(await readSessionRegistryRecords())
}
