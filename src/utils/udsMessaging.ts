import { createHash, randomUUID } from 'node:crypto'
import { chmod, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server, type Socket } from 'node:net'
import { getSessionId } from '../bootstrap/state.js'
import { registerCleanup } from './cleanupRegistry.js'

export const MAX_SESSION_FRAME_BYTES = 256 * 1024
const MAX_PENDING_MESSAGES = 100

export type SessionEnvelope = {
  version: 1
  type: 'message'
  id: string
  from: {
    sessionId: string
    address: string
    name?: string
  }
  text: string
  sentAt: string
}

type SessionMessageListener = (message: SessionEnvelope) => void

let server: Server | null = null
let socketPath: string | null = null
let unregisterCleanup: (() => void) | null = null
const listeners = new Set<SessionMessageListener>()
const pending: SessionEnvelope[] = []

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

export function getDefaultUdsSocketPath(seed = getSessionId()): string {
  const suffix = `${process.pid}-${shortHash(seed)}`
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\tovyr-${suffix}`
  }
  return join(tmpdir(), `tovyr-${suffix}.sock`)
}

export function getUdsMessagingSocketPath(): string | undefined {
  return socketPath ?? process.env.TOVYR_CODE_MESSAGING_SOCKET
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseSessionEnvelopeLine(line: string): SessionEnvelope {
  if (Buffer.byteLength(line) > MAX_SESSION_FRAME_BYTES) {
    throw new Error('Cross-session message exceeds the 256 KiB limit')
  }
  const parsed = JSON.parse(line) as unknown
  if (
    !isObject(parsed) ||
    parsed.version !== 1 ||
    parsed.type !== 'message' ||
    typeof parsed.id !== 'string' ||
    typeof parsed.text !== 'string' ||
    typeof parsed.sentAt !== 'string' ||
    !isObject(parsed.from) ||
    typeof parsed.from.sessionId !== 'string' ||
    typeof parsed.from.address !== 'string' ||
    (parsed.from.name !== undefined && typeof parsed.from.name !== 'string')
  ) {
    throw new Error('Invalid cross-session message envelope')
  }
  return parsed as SessionEnvelope
}

export function createSessionEnvelope(text: string): SessionEnvelope {
  const ownPath = getUdsMessagingSocketPath()
  if (!ownPath) {
    throw new Error('This Tovyr session does not have a messaging endpoint')
  }
  return {
    version: 1,
    type: 'message',
    id: randomUUID(),
    from: {
      sessionId: getSessionId(),
      address: `uds:${ownPath}`,
    },
    text,
    sentAt: new Date().toISOString(),
  }
}

function publish(message: SessionEnvelope): void {
  if (listeners.size === 0) {
    if (pending.length >= MAX_PENDING_MESSAGES) pending.shift()
    pending.push(message)
    return
  }
  for (const listener of listeners) listener(message)
}

export function subscribeUdsMessages(
  listener: SessionMessageListener,
): () => void {
  listeners.add(listener)
  while (pending.length > 0) {
    const message = pending.shift()
    if (message) listener(message)
  }
  return () => listeners.delete(listener)
}

function acceptConnection(connection: Socket): void {
  let buffered = Buffer.alloc(0)
  connection.on('data', chunk => {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    buffered = Buffer.concat([buffered, bytes])
    if (buffered.length > MAX_SESSION_FRAME_BYTES) {
      connection.destroy(
        new Error('Cross-session message exceeds the 256 KiB limit'),
      )
      return
    }
    const newline = buffered.indexOf(0x0a)
    if (newline === -1) return
    const line = buffered.subarray(0, newline).toString('utf8').trim()
    buffered = Buffer.alloc(0)
    try {
      publish(parseSessionEnvelopeLine(line))
      connection.end()
    } catch {
      connection.destroy()
    }
  })
}

export async function startUdsMessaging(
  path: string,
  _options?: { isExplicit?: boolean },
): Promise<void> {
  if (server && socketPath === path) return
  if (server) await stopUdsMessaging()

  if (process.platform !== 'win32') {
    await unlink(path).catch(() => {})
  }

  const nextServer = createServer(acceptConnection)
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      nextServer.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      nextServer.off('error', onError)
      resolve()
    }
    nextServer.once('error', onError)
    nextServer.once('listening', onListening)
    nextServer.listen(path)
  })
  if (process.platform !== 'win32') {
    try {
      await chmod(path, 0o600)
    } catch (error) {
      await new Promise<void>(resolve => nextServer.close(() => resolve()))
      await unlink(path).catch(() => {})
      throw error
    }
  }
  nextServer.unref()
  server = nextServer
  socketPath = path
  process.env.TOVYR_CODE_MESSAGING_SOCKET = path
  unregisterCleanup = registerCleanup(stopUdsMessaging)
}

export async function stopUdsMessaging(): Promise<void> {
  const active = server
  const activePath = socketPath
  server = null
  socketPath = null
  if (process.env.TOVYR_CODE_MESSAGING_SOCKET === activePath) {
    delete process.env.TOVYR_CODE_MESSAGING_SOCKET
  }
  unregisterCleanup?.()
  unregisterCleanup = null
  if (active) {
    await new Promise<void>(resolve => active.close(() => resolve()))
  }
  if (activePath && process.platform !== 'win32') {
    await unlink(activePath).catch(() => {})
  }
}
