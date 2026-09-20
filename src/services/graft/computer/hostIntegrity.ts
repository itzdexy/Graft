import { createHash, verify } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

export type ComputerHostManifest = {
  schemaVersion: 1
  sha256: string
  signature: string
}

export type ComputerHostVerification =
  | { verified: true; sha256: string }
  | { verified: false; reason: string }

function signedPayload(sha256: string): Buffer {
  return Buffer.from(`graft-computer-host\n${sha256}\n`, 'utf8')
}

export function verifyComputerHostFiles(
  hostPath: string,
  manifestPath: string,
  publicKeyPem: string,
): ComputerHostVerification {
  if (!publicKeyPem.trim()) {
    return { verified: false, reason: 'Computer host verification key is not configured.' }
  }
  if (!existsSync(hostPath) || !existsSync(manifestPath)) {
    return { verified: false, reason: 'Signed computer host or manifest is missing.' }
  }

  let manifest: ComputerHostManifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ComputerHostManifest
  } catch {
    return { verified: false, reason: 'Computer host manifest is invalid.' }
  }
  if (
    manifest.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/i.test(manifest.sha256) ||
    typeof manifest.signature !== 'string'
  ) {
    return { verified: false, reason: 'Computer host manifest has an invalid shape.' }
  }

  const actualHash = createHash('sha256')
    .update(readFileSync(hostPath))
    .digest('hex')
  if (actualHash.toLowerCase() !== manifest.sha256.toLowerCase()) {
    return { verified: false, reason: 'Computer host hash does not match its manifest.' }
  }
  try {
    const valid = verify(
      'sha256',
      signedPayload(manifest.sha256.toLowerCase()),
      publicKeyPem,
      Buffer.from(manifest.signature, 'base64'),
    )
    return valid
      ? { verified: true, sha256: actualHash }
      : { verified: false, reason: 'Computer host signature is invalid.' }
  } catch {
    return { verified: false, reason: 'Computer host signature could not be verified.' }
  }
}