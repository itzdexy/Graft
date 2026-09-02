import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getTovyrConfigHomeDir } from '../../../utils/envUtils.js'

export type TovyrComputerUseConfig = {
  enabled: boolean
  allowedApps: string[]
  screenshotRetention: 'never' | 'session'
}

const DEFAULT_CONFIG: TovyrComputerUseConfig = {
  enabled: false,
  allowedApps: [],
  screenshotRetention: 'never',
}

export function tovyrComputerRuntimeDir(): string {
  return join(getTovyrConfigHomeDir(), 'runtime')
}

export function tovyrComputerHostPath(): string {
  return join(
    tovyrComputerRuntimeDir(),
    process.platform === 'win32'
      ? 'tovyr-computer-host.exe'
      : 'tovyr-computer-host',
  )
}

function configPath(): string {
  return join(getTovyrConfigHomeDir(), 'computer-use.json')
}

export function readTovyrComputerUseConfig(): TovyrComputerUseConfig {
  try {
    const parsed = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<
      TovyrComputerUseConfig
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

export function writeTovyrComputerUseConfig(
  update:
    | Partial<TovyrComputerUseConfig>
    | ((current: TovyrComputerUseConfig) => TovyrComputerUseConfig),
): TovyrComputerUseConfig {
  const current = readTovyrComputerUseConfig()
  const next =
    typeof update === 'function'
      ? update(current)
      : { ...current, ...update }
  mkdirSync(getTovyrConfigHomeDir(), { recursive: true })
  const path = configPath()
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  renameSync(temporary, path)
  return next
}

export type TovyrComputerStatus = {
  platform: NodeJS.Platform
  supported: boolean
  enabled: boolean
  hostInstalled: boolean
  ready: boolean
  hostPath: string
  reason?: string
}

export function getTovyrComputerStatus(): TovyrComputerStatus {
  const config = readTovyrComputerUseConfig()
  const hostPath = tovyrComputerHostPath()
  const supported = process.platform === 'win32'
  const hostInstalled = existsSync(hostPath)
  let reason: string | undefined
  if (!supported) reason = 'Tovyr computer use beta currently supports Windows only.'
  else if (!config.enabled) reason = 'Computer use beta is disabled.'
  else if (!hostInstalled)
    reason =
      'The signed tovyr-computer-host is not installed under ~/.tovyr/runtime.'
  return {
    platform: process.platform,
    supported,
    enabled: config.enabled,
    hostInstalled,
    ready: supported && config.enabled && hostInstalled,
    hostPath,
    reason,
  }
}

export function formatTovyrComputerStatus(): string {
  const status = getTovyrComputerStatus()
  return [
    '# Tovyr computer use beta',
    '',
    `Platform: ${status.platform}${status.supported ? ' (supported)' : ' (unsupported)'}`,
    `Feature: ${status.enabled ? 'enabled' : 'disabled'}`,
    `Signed host: ${status.hostInstalled ? 'installed' : 'not installed'}`,
    `State: ${status.ready ? 'Ready' : 'Unavailable'}`,
    status.reason || '',
    '',
    'Passive observation is allowed. Tovyr asks before clicks, typing, forms, files, clipboard, or desktop control.',
    'Purchases, messages, account changes, secrets, elevation, and destructive actions always require reconfirmation.',
    `Host path: ${status.hostPath}`,
  ]
    .filter(Boolean)
    .join('\n')
}
