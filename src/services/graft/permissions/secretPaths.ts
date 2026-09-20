import { basename, normalize } from 'path'

/** Basenames that may contain secrets — require explicit approval to read. */
const SECRET_BASENAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.test',
  'credentials.json',
  'secrets.json',
  'id_rsa',
  'id_ed25519',
  'id_dsa',
  'known_hosts',
  '.npmrc',
  '.pypirc',
  '.netrc',
  '.htpasswd',
  'serviceAccountKey.json',
  'firebase-adminsdk.json',
])

const SECRET_SUFFIXES = [
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.kdbx',
  '.cer',
  '.crt',
] as const

const SECRET_DIR_MARKERS = [
  '/.ssh/',
  '/.aws/',
  '/.gnupg/',
  '/.config/gcloud/',
  '/AppData/Roaming/Microsoft/Credentials/',
  '/Library/Keychains/',
] as const

export type SecretPathMatch = {
  label: string
  basename: string
}

function normalizedPathForCheck(filePath: string): string {
  return normalize(filePath).replace(/\\/g, '/')
}

/** True when a file path likely contains credentials or private keys. */
export function matchSecretPath(filePath: string): SecretPathMatch | null {
  if (!filePath.trim()) return null

  const norm = normalizedPathForCheck(filePath)
  const base = basename(norm)

  if (SECRET_BASENAMES.has(base)) {
    return { label: 'environment or credential file', basename: base }
  }

  for (const suffix of SECRET_SUFFIXES) {
    if (base.endsWith(suffix)) {
      return { label: 'private key or certificate', basename: base }
    }
  }

  for (const marker of SECRET_DIR_MARKERS) {
    if (norm.includes(marker)) {
      return { label: 'credential store path', basename: base }
    }
  }

  if (/\/\.env(\.|$)/.test(norm)) {
    return { label: 'environment file', basename: base }
  }

  return null
}

export function formatSecretPathBlockMessage(match: SecretPathMatch): string {
  return (
    `Graft blocked read access to a sensitive file (${match.label}: ${match.basename}). ` +
    'Confirm with the user before reading secrets, or use /bypass only if they explicitly accept the risk.'
  )
}
