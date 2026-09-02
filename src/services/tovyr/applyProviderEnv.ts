import { getProvider, resolveActive } from '../../../scripts/tovyr-providers.js'
import { providerNeedsOpenAiCompat } from '../../../scripts/tovyr-provider-upstream.js'
import {
  applyOpenAiCompatProxyEnv,
  stopOpenAiCompatProxy,
} from './openaiCompat/proxy.js'

export type ActiveProviderLike = {
  providerId: string
  baseUrl: string
  apiKey: string
  model?: string
  authMode?: 'apiKey' | 'authToken' | 'oauth'
}

/** Env keys for direct Tovyr routing (no OpenAI-compat proxy). */
export function buildDirectAnthropicEnvPatch(
  active: ActiveProviderLike,
): Record<string, string | undefined> {
  const patch: Record<string, string | undefined> = {
    TOVYR_ACTIVE_PROVIDER: active.providerId,
    TOVYR_PROVIDER_AUTH_MODE: active.authMode,
    ANTHROPIC_BASE_URL: active.baseUrl,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: undefined,
    ANTHROPIC_DEFAULT_SONNET_MODEL: undefined,
    ANTHROPIC_DEFAULT_OPUS_MODEL: undefined,
    TOVYR_CODE_SUBAGENT_MODEL: undefined,
  }
  if (active.model) {
    patch.ANTHROPIC_MODEL = active.model
  } else {
    patch.ANTHROPIC_MODEL = undefined
  }
  if (active.authMode === 'oauth') {
    patch.ANTHROPIC_API_KEY = undefined
    patch.ANTHROPIC_AUTH_TOKEN = undefined
  } else if (active.authMode === 'authToken') {
    patch.ANTHROPIC_AUTH_TOKEN = active.apiKey
    patch.ANTHROPIC_API_KEY = ''
  } else {
    patch.ANTHROPIC_API_KEY = active.apiKey
    patch.ANTHROPIC_AUTH_TOKEN = undefined
  }
  return patch
}

function applyEnvPatch(patch: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

/** Point process.env at the active provider (with OpenAI-compat proxy when needed). */
export function applyTovyrActiveProviderToEnv(active: ActiveProviderLike): void {
  const def = getProvider(active.providerId)
  const upstreamKey = active.apiKey || 'local'
  if (providerNeedsOpenAiCompat(def) && upstreamKey) {
    if (active.model) {
      process.env.ANTHROPIC_MODEL = active.model
    } else {
      delete process.env.ANTHROPIC_MODEL
    }
    applyOpenAiCompatProxyEnv({
      providerId: active.providerId,
      upstreamBaseUrl: active.baseUrl,
      upstreamApiKey: upstreamKey,
      authMode: active.authMode,
    })
    if (active.model) {
      process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = active.model
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = active.model
      process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = active.model
      process.env.TOVYR_CODE_SUBAGENT_MODEL = active.model
    }
    return
  }

  stopOpenAiCompatProxy()
  applyEnvPatch(buildDirectAnthropicEnvPatch(active))
}

/** Re-apply ~/.tovyr routing after settings.env (sync). */
export function reapplyTovyrProviderEnvFromDisk(): void {
  if (
    !process.env.TOVYR_PACKAGE_ROOT &&
    !process.env.TOVYR_SRC &&
    process.env.TOVYR_FORCE_INTERACTIVE !== '1'
  ) {
    return
  }

  const active = resolveActive()
  if (!active || (!active.apiKey && active.authMode !== 'oauth')) return

  applyTovyrActiveProviderToEnv({
    providerId: active.providerId,
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model: active.model,
    authMode: active.authMode,
  })
}
