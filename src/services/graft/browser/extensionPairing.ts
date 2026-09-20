import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const PAIRING_TTL_MS = 5 * 60 * 1000
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

type PairingRecord = { extensionId: string; hash: string; expiresAt: number }
type SessionRecord = { extensionId: string; hash: string; expiresAt: number }

const pairings = new Map<string, PairingRecord>()
const sessions = new Map<string, SessionRecord>()

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function matches(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(hash(value), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function randomSecret(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

export type ExtensionPairingCode = {
  code: string
  expiresAt: number
}

export type ExtensionSession = {
  token: string
  extensionId: string
  expiresAt: number
}

export function createExtensionPairingCode(
  extensionId: string,
  now = Date.now(),
): ExtensionPairingCode {
  const normalized = extensionId.trim()
  if (!normalized) throw new Error('Extension id is required.')
  const code = randomSecret(12)
  const expiresAt = now + PAIRING_TTL_MS
  pairings.set(code, { extensionId: normalized, hash: hash(code), expiresAt })
  return { code, expiresAt }
}

export function redeemExtensionPairingCode(
  code: string,
  extensionId: string,
  now = Date.now(),
): ExtensionSession | null {
  const record = pairings.get(code)
  pairings.delete(code)
  if (!record || record.expiresAt <= now || record.extensionId !== extensionId.trim()) {
    return null
  }
  if (!matches(code, record.hash)) return null
  const token = randomSecret()
  const expiresAt = now + SESSION_TTL_MS
  sessions.set(token, { extensionId: record.extensionId, hash: hash(token), expiresAt })
  return { token, extensionId: record.extensionId, expiresAt }
}

export function verifyExtensionSession(
  token: string,
  extensionId: string,
  now = Date.now(),
): boolean {
  const record = sessions.get(token)
  if (!record || record.expiresAt <= now || record.extensionId !== extensionId.trim()) {
    if (record?.expiresAt <= now) sessions.delete(token)
    return false
  }
  return matches(token, record.hash)
}

export function revokeExtensionSessions(extensionId: string): void {
  const normalized = extensionId.trim()
  for (const [token, record] of sessions) {
    if (record.extensionId === normalized) sessions.delete(token)
  }
}

export function resetExtensionPairingState(): void {
  pairings.clear()
  sessions.clear()
}