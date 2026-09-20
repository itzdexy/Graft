import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getGlobalConfig, saveGlobalConfig } from '../../../utils/config.js'
import { getGraftConfigHomeDir } from '../../../utils/envUtils.js'

export const PLAYWRIGHT_MCP_SERVER_NAME = 'playwright'
export const PLAYWRIGHT_MCP_VERSION = '0.0.78'
export const PLAYWRIGHT_MCP_PACKAGE =
  `@playwright/mcp@${PLAYWRIGHT_MCP_VERSION}`

export type PlaywrightConnectionMode =
  | { kind: 'isolated' }
  | { kind: 'cdp'; endpoint: string }

export type PlaywrightMcpStatus = {
  configured: boolean
  pinned: boolean
  mode: 'isolated' | 'cdp' | 'custom'
  packageVersion: string
  profileDir: string
  outputDir: string
}

export function validatePlaywrightCdpEndpoint(endpoint: string): {
  ok: true
  endpoint: string
} | {
  ok: false
  message: string
} {
  const value = endpoint.trim()
  if (!value) return { ok: false, message: 'A CDP endpoint is required.' }
  // Named browser endpoints are accepted by the Playwright MCP runtime.
  if (!value.includes('://')) return { ok: true, endpoint: value }
  try {
    const url = new URL(value)
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
      return { ok: false, message: 'CDP endpoint must use http(s) or ws(s).' }
    }
    if (url.username || url.password || url.hash) {
      return {
        ok: false,
        message: 'CDP endpoints cannot contain credentials or URL fragments.',
      }
    }
    return { ok: true, endpoint: url.toString() }
  } catch {
    return { ok: false, message: 'CDP endpoint must be a valid URL.' }
  }
}

function graftBrowserPaths(): { profileDir: string; outputDir: string } {
  const root = join(getGraftConfigHomeDir(), 'browser')
  return {
    profileDir: join(root, 'profile'),
    outputDir: join(root, 'output'),
  }
}

export function buildPlaywrightMcpConfig(
  mode: PlaywrightConnectionMode = { kind: 'isolated' },
): { command: string; args: string[]; env: Record<string, string> } {
  const { profileDir, outputDir } = graftBrowserPaths()
  const args = [
    '-y',
    PLAYWRIGHT_MCP_PACKAGE,
    '--output-dir',
    outputDir,
    '--output-max-size',
    String(256 * 1024 * 1024),
    '--caps',
    'pdf,devtools',
    '--block-service-workers',
    '--timeout-action',
    '5000',
    '--timeout-navigation',
    '30000',
    '--image-responses',
    'omit',
  ]

  if (mode.kind === 'cdp') {
    const endpoint = validatePlaywrightCdpEndpoint(mode.endpoint)
    if (!endpoint.ok) throw new Error(endpoint.message)
    args.push('--cdp-endpoint', endpoint.endpoint)
  } else {
    // This persistent profile is isolated from the user's normal browser.
    args.push('--user-data-dir', profileDir)
  }

  return {
    command: 'npx',
    args,
    env: {
      PLAYWRIGHT_MCP_OUTPUT_MODE: 'stdout',
      PLAYWRIGHT_MCP_SNAPSHOT_MODE: 'full',
    },
  }
}

export async function configurePlaywrightMcp(
  mode: PlaywrightConnectionMode = { kind: 'isolated' },
): Promise<PlaywrightMcpStatus> {
  const { profileDir, outputDir } = graftBrowserPaths()
  await Promise.all([
    mkdir(profileDir, { recursive: true }),
    mkdir(outputDir, { recursive: true }),
  ])
  const config = buildPlaywrightMcpConfig(mode)
  saveGlobalConfig(current => ({
    ...current,
    mcpServers: {
      ...current.mcpServers,
      [PLAYWRIGHT_MCP_SERVER_NAME]: config,
    },
  }))
  return getPlaywrightMcpStatus()
}

export function getPlaywrightMcpStatus(): PlaywrightMcpStatus {
  const { profileDir, outputDir } = graftBrowserPaths()
  const config = getGlobalConfig().mcpServers?.[PLAYWRIGHT_MCP_SERVER_NAME]
  const args =
    config && 'args' in config && Array.isArray(config.args)
      ? config.args.map(String)
      : []
  const packageArg = args.find(arg => arg.startsWith('@playwright/mcp@')) || ''
  const cdp = args.indexOf('--cdp-endpoint')
  return {
    configured: !!config,
    pinned: packageArg === PLAYWRIGHT_MCP_PACKAGE,
    mode:
      cdp >= 0
        ? 'cdp'
        : args.includes('--user-data-dir')
          ? 'isolated'
          : 'custom',
    packageVersion: packageArg.split('@').at(-1) || 'unknown',
    profileDir,
    outputDir,
  }
}

export function getPlaywrightMcpHint(): string {
  const status = getPlaywrightMcpStatus()
  return [
    '# Graft browser automation',
    '',
    status.configured
      ? `Playwright MCP ${status.pinned ? PLAYWRIGHT_MCP_VERSION : status.packageVersion} is configured (${status.mode}).`
      : `Playwright MCP ${PLAYWRIGHT_MCP_VERSION} is not configured.`,
    `Runtime: ${PLAYWRIGHT_MCP_PACKAGE}`,
    '',
    '- `/browser setup` creates a pinned, Graft-owned browser profile.',
    '- `/browser connect chrome` explicitly opts into a running Chrome session.',
    '- Restart Graft or run `/mcp` after changing browser configuration.',
    '',
    `Profile: ${status.profileDir}`,
    `Downloads and captures: ${status.outputDir}`,
    '',
    'Graft uses accessibility snapshots first. Screenshots are reserved for visual checks.',
  ].join('\n')
}

export function isPlaywrightMcpConfigured(mcpServerNames: string[]): boolean {
  return mcpServerNames.some(n => n.toLowerCase() === PLAYWRIGHT_MCP_SERVER_NAME)
}
