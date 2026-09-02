import { createConnection } from 'node:net'
import {
  createSessionEnvelope,
  MAX_SESSION_FRAME_BYTES,
} from './udsMessaging.js'
export { listAllLiveSessions } from './peerRegistry.js'

export async function sendToUdsSocket(
  path: string,
  text: string,
): Promise<void> {
  if (Buffer.byteLength(text) > MAX_SESSION_FRAME_BYTES) {
    throw new Error('Cross-session message exceeds the 256 KiB limit')
  }
  const frame = `${JSON.stringify(createSessionEnvelope(text))}\n`
  if (Buffer.byteLength(frame) > MAX_SESSION_FRAME_BYTES) {
    throw new Error('Cross-session message exceeds the 256 KiB limit')
  }

  await new Promise<void>((resolve, reject) => {
    const connection = createConnection(path)
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      error ? reject(error) : resolve()
    }
    connection.once('error', finish)
    connection.once('connect', () => {
      connection.end(frame, () => finish())
    })
  })
}
