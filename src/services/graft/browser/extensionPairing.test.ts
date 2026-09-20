import { afterEach, describe, expect, test } from 'bun:test'
import {
  createExtensionPairingCode,
  redeemExtensionPairingCode,
  resetExtensionPairingState,
  verifyExtensionSession,
} from './extensionPairing.js'

describe('Graft browser extension pairing', () => {
  afterEach(resetExtensionPairingState)

  test('redeems a pairing code once and scopes the session to its extension', () => {
    const pairing = createExtensionPairingCode('extension-a', 100)
    const session = redeemExtensionPairingCode(pairing.code, 'extension-a', 101)
    expect(session).not.toBeNull()
    expect(verifyExtensionSession(session!.token, 'extension-a', 102)).toBe(true)
    expect(verifyExtensionSession(session!.token, 'extension-b', 102)).toBe(false)
    expect(redeemExtensionPairingCode(pairing.code, 'extension-a', 102)).toBeNull()
  })

  test('expires pairing codes and sessions', () => {
    const pairing = createExtensionPairingCode('extension-a', 100)
    expect(redeemExtensionPairingCode(pairing.code, 'extension-a', pairing.expiresAt)).toBeNull()
  })
})