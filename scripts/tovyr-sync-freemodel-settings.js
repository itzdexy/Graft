/**
 * Sync ~/.tovyr/settings.json for the active Tovyr provider.
 *
 * Tovyr credentials and provider env are isolated under ~/.tovyr; we do not
 * write them to foreign ~/.claude configuration.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { mergeTovyrCompatIntoSettingsEnv } from './tovyr-model-compat.js'

export const FREEMODEL_BASE_URL = 'https://cc.freemodel.dev'

/**
 * Write ~/.tovyr/settings.json for the active Tovyr provider.
 * @param {string} apiKey
 * @param {{ baseUrl?: string, model?: string, authMode?: 'apiKey'|'authToken', providerId?: string }} [opts]
 */
export function syncProviderSettings(apiKey, opts = {}) {
  if (!apiKey || apiKey.length < 8) {
    throw new Error('Invalid API key')
  }

  const baseUrl = opts.baseUrl || FREEMODEL_BASE_URL
  const authMode = opts.authMode || 'apiKey'
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const tovyrDir = join(home, '.tovyr')
  const settingsPath = join(tovyrDir, 'settings.json')

  if (!existsSync(tovyrDir)) {
    mkdirSync(tovyrDir, { recursive: true })
  }

  let settings = {}
  if (existsSync(settingsPath)) {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
  }

  const {
    ANTHROPIC_MODEL: _m,
    ANTHROPIC_API_KEY: _k,
    ANTHROPIC_AUTH_TOKEN: _t,
    ...envRest
  } = settings.env || {}

  const providerId = opts.providerId || 'freemodel'
  const authEnv = {
    ...envRest,
    ANTHROPIC_BASE_URL: baseUrl,
    TOVYR_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    ...(opts.model ? { ANTHROPIC_MODEL: opts.model } : {}),
  }

  // One auth mechanism per provider — never leave both key + token set.
  // Direct env vars are more reliable on Windows than apiKeyHelper shell one-liners.
  if (authMode === 'authToken') {
    authEnv.ANTHROPIC_AUTH_TOKEN = apiKey
    authEnv.ANTHROPIC_API_KEY = ''
    delete settings.apiKeyHelper
  } else {
    authEnv.ANTHROPIC_API_KEY = apiKey
    authEnv.ANTHROPIC_AUTH_TOKEN = ''
    delete settings.apiKeyHelper
  }

  settings.env = mergeTovyrCompatIntoSettingsEnv(
    authEnv,
    providerId,
    opts.model || '',
  )

  if (!settings.permissions) {
    settings.permissions = { allow: [], deny: [] }
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  return settingsPath
}

/** Back-compat wrapper for FreeModel-only callers. */
export function syncFreeModelSettings(apiKey, opts = {}) {
  return syncProviderSettings(apiKey, { baseUrl: FREEMODEL_BASE_URL, ...opts })
}

if (process.argv[1]?.endsWith('tovyr-sync-freemodel-settings.js')) {
  const key =
    process.argv[2]?.trim() ||
    (existsSync(join(process.env.USERPROFILE || '', '.tovyr', 'api-key'))
      ? readFileSync(
          join(process.env.USERPROFILE || '', '.tovyr', 'api-key'),
          'utf8',
        ).trim()
      : '')

  if (!key) {
    console.error('Usage: node tovyr-sync-freemodel-settings.js <fe_oa_...>')
    process.exit(1)
  }

  const path = syncProviderSettings(key)
  console.log(`Provider settings written to ${path}`)
}
