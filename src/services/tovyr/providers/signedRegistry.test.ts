import { describe, expect, test } from 'bun:test'
import { generateKeyPairSync, sign } from 'node:crypto'
import type { ProviderRegistryPayload } from './signedRegistry.js'
import { verifySignedProviderRegistry } from './signedRegistry.js'

describe('signed provider registry', () => {
  test('accepts a valid date-stamped Ed25519 envelope', () => {
    const pair = generateKeyPairSync('ed25519')
    const payload: ProviderRegistryPayload = {
      schemaVersion: 1,
      publishedAt: new Date(Date.now() - 1_000).toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      providers: { example: [] },
    }
    const signature = sign(
      null,
      Buffer.from(JSON.stringify(payload)),
      pair.privateKey,
    ).toString('base64')
    const publicKey = pair.publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string
    expect(
      verifySignedProviderRegistry(
        { payload, signature, keyId: 'test' },
        publicKey,
      ),
    ).toEqual(payload)
  })

  test('rejects tampering and expired registries', () => {
    const pair = generateKeyPairSync('ed25519')
    const payload: ProviderRegistryPayload = {
      schemaVersion: 1,
      publishedAt: new Date(Date.now() - 10_000).toISOString(),
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      providers: { example: [] },
    }
    const signature = sign(
      null,
      Buffer.from(JSON.stringify(payload)),
      pair.privateKey,
    ).toString('base64')
    const publicKey = pair.publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string
    expect(
      verifySignedProviderRegistry(
        { payload, signature, keyId: 'test' },
        publicKey,
      ),
    ).toBeNull()
  })
})
