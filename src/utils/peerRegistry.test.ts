import { describe, expect, test } from 'bun:test'
import { projectLiveSessionPeers } from './peerRegistry.js'

describe('session peer registry', () => {
  test('returns live addressable peers and excludes self, stale, and unaddressable records', () => {
    const peers = projectLiveSessionPeers(
      [
        {
          pid: 10,
          sessionId: 'self',
          cwd: 'C:\\repo',
          startedAt: 1,
          kind: 'interactive',
          messagingSocketPath: '\\\\.\\pipe\\self',
        },
        {
          pid: 11,
          sessionId: 'live',
          cwd: 'C:\\repo',
          startedAt: 2,
          updatedAt: 3,
          kind: 'interactive',
          name: 'reviewer',
          status: 'idle',
          messagingSocketPath: '\\\\.\\pipe\\live',
        },
        {
          pid: 12,
          sessionId: 'stale',
          cwd: 'C:\\other',
          startedAt: 2,
          kind: 'interactive',
          messagingSocketPath: '\\\\.\\pipe\\stale',
        },
        {
          pid: 13,
          sessionId: 'no-address',
          cwd: 'C:\\repo',
          startedAt: 2,
          kind: 'interactive',
        },
      ],
      { currentPid: 10, isProcessRunning: pid => pid === 11 },
    )

    expect(peers).toEqual([
      {
        pid: 11,
        sessionId: 'live',
        cwd: 'C:\\repo',
        name: 'reviewer',
        status: 'idle',
        kind: 'interactive',
        updatedAt: 3,
        address: 'uds:\\\\.\\pipe\\live',
      },
    ])
  })
})
