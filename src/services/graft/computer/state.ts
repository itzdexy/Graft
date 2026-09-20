import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getGraftConfigHomeDir } from '../../../utils/envUtils.js'
import { verifyComputerHostFiles } from './hostIntegrity.js'

export type GraftComputerUseConfig = {
  enabled: boolean
  allowedApps: string[]
  screenshotRetention: 'never' | 'session'
}

const DEFAULT_CONFIG: GraftComputerUseConfig = {
  enabled: false,
  allowedApps: [],
  screenshotRetention: 'never',
}

export function graftComputerRuntimeDir(): string {
  return join(getGraftConfigHomeDir(), 'runtime')
}

export function graftComputerHostPath(): string {
  return join(
    graftComputerRuntimeDir(),
    process.platform === 'win32'
      ? 'graft-computer-host.exe'
      : 'graft-computer-host',
  )
}

export function graftComputerHostManifestPath(): string {
  return join(graftComputerRuntimeDir(), 'graft-computer-host.manifest.json')
}

function configPath(): string {
  return join(getGraftConfigHomeDir(), 'computer-use.json')
}

export function readGraftComputerUseConfig(): GraftComputerUseConfig {
  try {
    const parsed = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<
      GraftComputerUseConfig
    >
    return {
      enabled: parsed.enabled === true,
      allowedApps: Array.isArray(parsed.allowedApps)
        ? parsed.allowedApps.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
      screenshotRetention:
        parsed.screenshotRetention === 'session' ? 'session' : 'never',
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function writeGraftComputerUseConfig(
  update:
    | Partial<GraftComputerUseConfig>
    | ((current: GraftComputerUseConfig) => GraftComputerUseConfig),
): GraftComputerUseConfig {
  const current = readGraftComputerUseConfig()
  const next =
    typeof update === 'function'
      ? update(current)
      : { ...current, ...update }
  mkdirSync(getGraftConfigHomeDir(), { recursive: true })
  const path = configPath()
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  renameSync(temporary, path)
  return next
}

export type GraftComputerStatus = {
  platform: NodeJS.Platform
  supported: boolean
  enabled: boolean
  hostInstalled: boolean
  hostVerified: boolean
  ready: boolean
  hostPath: string
  reason?: string
}

export function getGraftComputerStatus(): GraftComputerStatus {
  const config = readGraftComputerUseConfig()
  const hostPath = graftComputerHostPath()
  const supported = process.platform === 'win32'
  const hostInstalled = existsSync(hostPath)
  const verification = verifyComputerHostFiles(
    hostPath,
    graftComputerHostManifestPath(),
    process.env.GRAFT_COMPUTER_HOST_PUBLIC_KEY || '',
  )
  const hostVerified = verification.verified
  let reason: string | undefined
  if (!supported) reason = 'Graft computer use beta currently supports Windows only.'
  else if (!config.enabled) reason = 'Computer use beta is disabled.'
  else if (!hostInstalled)
    reason =
      'The signed graft-computer-host is not installed under ~/.graft/runtime.'
  else if (!hostVerified) reason = verification.reason
  return {
    platform: process.platform,
    supported,
    enabled: config.enabled,
    hostInstalled,
    hostVerified,
    ready: supported && config.enabled && hostInstalled,
    hostPath,
    reason,
  }
}

export function formatGraftComputerStatus(): string {
  const status = getGraftComputerStatus()
  return [
    '# Graft computer use beta',
    '',
    `Platform: ${status.platform}${status.supported ? ' (supported)' : ' (unsupported)'}`,
    `Feature: ${status.enabled ? 'enabled' : 'disabled'}`,
    `Signed host: ${status.hostVerified ? 'verified' : status.hostInstalled ? 'unverified' : 'not installed'}`,
    `State: ${status.ready ? 'Ready' : 'Unavailable'}`,
    status.reason || '',
    '',
    'Passive observation is allowed. Graft asks before clicks, typing, forms, files, clipboard, or desktop control.',
    'Purchases, messages, account changes, secrets, elevation, and destructive actions always require reconfirmation.',
    `Host path: ${status.hostPath}`,
  ]
    .filter(Boolean)
    .join('\n')
}
