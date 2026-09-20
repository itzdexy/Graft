import { describe, expect, test } from 'bun:test'
import { ListPeersTool } from './ListPeersTool.js'

describe('ListPeersTool', () => {
  test('is a read-only discovery tool and serializes reusable addresses', () => {
    expect(ListPeersTool.isReadOnly({})).toBe(true)
    expect(
      ListPeersTool.mapToolResultToToolResultBlockParam(
        {
          peers: [
            {
              pid: 42,
              sessionId: 'session-42',
              cwd: 'C:\\repo',
              kind: 'interactive',
              name: 'reviewer',
              status: 'idle',
              address: 'uds:\\\\.\\pipe\\graft-42',
            },
          ],
        },
        'tool-1',
      ).content,
    ).toContain('uds:\\\\.\\pipe\\graft-42')
  })
})
