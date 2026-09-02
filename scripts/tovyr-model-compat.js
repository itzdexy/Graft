/**
 * Per-provider / per-model env tuning so third-party gateways work with
 * Tovyr's full tool surface (skills, MCP, bash, agents).
 */
import { PROVIDER_CATALOG } from './tovyr-provider-catalog.js'

/** Env keys owned by compat tuning — cleared when switching providers. */
export const TOVYR_COMPAT_ENV_KEYS = [
  'TOVYR_CODE_DISABLE_THINKING',
  'DISABLE_INTERLEAVED_THINKING',
  'ENABLE_TOOL_SEARCH',
]

const OFFICIAL_ANTHROPIC_BASES = new Set([
  'https://api.anthropic.com',
  'https://cc.freemodel.dev',
])

/** @param {string} baseUrl */
function normalizeBaseUrl(baseUrl) {
  return (baseUrl || '').replace(/\/+$/, '')
}

/** @param {{ id?: string, baseUrl?: string }|null|undefined} provider */
export function isOfficialClaudeProvider(provider) {
  if (!provider) return false
  if (provider.id === 'anthropic' || provider.id === 'freemodel') return true
  return OFFICIAL_ANTHROPIC_BASES.has(normalizeBaseUrl(provider.baseUrl))
}

/** @param {string|undefined|null} modelId */
export function modelLooksLikeClaude(modelId) {
  const m = (modelId || '').toLowerCase()
  return m.includes('claude') || m.includes('anthropic/')
}

/**
 * Env overrides for the active provider + model.
 * @param {string} providerId
 * @param {string} [modelId]
 * @returns {Record<string, string>}
 */
export function getTovyrProviderCompatEnv(providerId, modelId = '') {
  const provider = PROVIDER_CATALOG[providerId]
  const env = {}
  const official = isOfficialClaudeProvider(provider)
  const claudeModel = modelLooksLikeClaude(modelId)

  // Extended / interleaved thinking breaks most non-Claude models and many gateways.
  if (!official || !claudeModel) {
    env.TOVYR_CODE_DISABLE_THINKING = '1'
    env.DISABLE_INTERLEAVED_THINKING = '1'
  }

  // Third-party Anthropic proxies often reject tool_reference blocks.
  // Default off unless user explicitly sets ENABLE_TOOL_SEARCH — MCP tools still load.
  if (!official) {
    env.ENABLE_TOOL_SEARCH = 'false'
  }

  return env
}

/**
 * Apply compat env to the current process (and return the merged object).
 * @param {string} providerId
 * @param {string} [modelId]
 */
export function applyTovyrProviderCompatToProcess(providerId, modelId = '') {
  const compat = getTovyrProviderCompatEnv(providerId, modelId)
  for (const key of TOVYR_COMPAT_ENV_KEYS) {
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(compat)) {
    process.env[key] = value
  }
  return compat
}

/**
 * Merge compat into settings.env and strip stale compat keys.
 * @param {Record<string, unknown>} env
 * @param {string} providerId
 * @param {string} [modelId]
 */
export function mergeTovyrCompatIntoSettingsEnv(env, providerId, modelId = '') {
  const next = { ...(env || {}) }
  for (const key of TOVYR_COMPAT_ENV_KEYS) {
    delete next[key]
  }
  return { ...next, ...getTovyrProviderCompatEnv(providerId, modelId) }
}
