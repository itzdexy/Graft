import { afterEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import {
  MAX_SESSION_FRAME_BYTES,
  getDefaultUdsSocketPath,
  getUdsMessagingSocketPath,
  startUdsMessaging,
  stopUdsMessaging,
  subscribeUdsMessages,
} from './udsMessaging.js'
import { sendToUdsSocket } from './udsClient.js'

afterEach(async () => {
  await stopUdsMessaging()
})

describe('local session messaging', () => {
  test('uses a Windows named pipe or a bounded Unix socket path', () => {
    const address = getDefaultUdsSocketPath(`test-${process.pid}`)
    if (process.platform === 'win32') {
      expect(address.startsWith('\\\\.\\pipe\\tovyr-')).toBe(true)
    } else {
      expect(address.includes('tovyr-')).toBe(true)
      expect(Buffer.byteLength(address)).toBeLessThan(104)
    }
  })

  test('delivers an attributed versioned message to a live session', async () => {
    const path = getDefaultUdsSocketPath(`test-${process.pid}-${randomUUID()}`)
    const received = new Promise<{
      version: number
      type: string
      text: string
      from: { address: string; sessionId: string }
    }>(resolve => {
      const unsubscribe = subscribeUdsMessages(message => {
        unsubscribe()
        resolve(message)
      })
    })

    await startUdsMessaging(path, { isExplicit: true })
    await sendToUdsSocket(path, 'review the current diff')

    expect(await received).toMatchObject({
      version: 1,
      type: 'message',
      text: 'review the current diff',
      from: {
        address: `uds:${path}`,
      },
    })
    expect(getUdsMessagingSocketPath()).toBe(path)
  })

  test('rejects oversized messages before opening a connection', async () => {
    await expect(
      sendToUdsSocket('unused', 'x'.repeat(MAX_SESSION_FRAME_BYTES + 1)),
    ).rejects.toThrow('256 KiB')
  })
})
