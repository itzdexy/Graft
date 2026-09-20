import { describe, expect, test } from 'bun:test'
import { generateKeyPairSync, createHash, sign } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifyComputerHostFiles } from './hostIntegrity.js'

describe('computer host integrity', () => {
  test('requires a matching signed host manifest', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const root = mkdtempSync(join(tmpdir(), 'graft-host-'))
    const hostPath = join(root, 'graft-computer-host.exe')
    const manifestPath = join(root, 'graft-computer-host.manifest.json')
    writeFileSync(hostPath, 'signed fixture host')
    const sha256 = createHash('sha256').update('signed fixture host').digest('hex')
    const signature = sign(
      'sha256',
      Buffer.from(`graft-computer-host\n${sha256}\n`),
      privateKey,
    ).toString('base64')
    writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, sha256, signature }))

    expect(
      verifyComputerHostFiles(hostPath, manifestPath, publicKey.export({ type: 'pkcs1', format: 'pem' }).toString()),
    ).toMatchObject({ verified: true, sha256 })
  })

  test('rejects a modified host', () => {
    const root = mkdtempSync(join(tmpdir(), 'graft-host-'))
    const hostPath = join(root, 'host.exe')
    const manifestPath = join(root, 'host.manifest.json')
    writeFileSync(hostPath, 'modified')
    writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, sha256: '0'.repeat(64), signature: 'bad' }))
    expect(verifyComputerHostFiles(hostPath, manifestPath, 'bad').verified).toBe(false)
  })
})