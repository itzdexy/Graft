import { getProvider } from '../../../scripts/tovyr-providers.js'
import { formatProviderModelDisplayName } from '../../../scripts/tovyr-model-display.js'
import { providerNeedsOpenAiCompat } from '../../../scripts/tovyr-provider-upstream.js'

export type OfficialProviderLogin = {
  id: 'codex' | 'gemini-cli' | 'claude-subscription'
  label: string
  command: string
}

const OFFICIAL_LOGINS: Record<string, OfficialProviderLogin> = {
  openai: {
    id: 'codex',
    label: 'ChatGPT account',
    command: 'tovyr auth login --provider codex',
  },
  google: {
    id: 'gemini-cli',
    label: 'Google account',
    command: 'tovyr auth login --provider gemini-cli',
  },
  anthropic: {
    id: 'claude-subscription',
    label: 'Anthropic account',
    command: 'tovyr auth login --provider claude-subscription',
  },
}

export function getOfficialProviderLogin(
  providerId: string,
): OfficialProviderLogin | null {
  return OFFICIAL_LOGINS[providerId] ?? null
}

export function formatConnectedModelMessage(input: {
  providerId?: string
  modelId?: string
  providerLabel: string
  modelLabel: string
}): string {
  const modelLabel = formatProviderModelDisplayName({
    providerId: input.providerId,
    modelId: input.modelId ?? input.modelLabel,
    label: input.modelLabel,
  })
  return [
    'AI connected.',
    `${input.providerLabel} · ${modelLabel}`,
    '',
    'Talk to Tovyr — ask a question or describe what you want to build.',
  ].join('\n')
}

export type CredentialProbeResult =
  | { ok: true; verified: boolean; message: string }
  | { ok: false; verified: false; message: string }

export function classifyCredentialProbe(
  statuses: number[],
  providerLabel: string,
): CredentialProbeResult {
  if (statuses.some(status => status === 401 || status === 403)) {
    return {
      ok: false,
      verified: false,
      message: `${providerLabel} rejected that API key. Check it and try again.`,
    }
  }
  if (statuses.some(status => status >= 200 && status < 300)) {
    return {
      ok: true,
      verified: true,
      message: `${providerLabel} accepted the API key.`,
    }
  }
  if (statuses.length > 0) {
    return {
      ok: true,
      verified: false,
      message: `${providerLabel} is reachable. The key will be fully checked on the first request.`,
    }
  }
  return {
    ok: false,
    verified: false,
    message: `Could not reach ${providerLabel}. Check your connection and try again.`,
  }
}

/**
 * Verify a credential before persisting it. A 401/403 is always rejected.
 * Some Tovyr-compatible gateways do not expose a models endpoint; a reachable
 * non-auth response is accepted but is never described as verified.
 */
export async function verifyProviderApiKey(
  providerId: string,
  apiKey: string,
): Promise<CredentialProbeResult> {
  const provider = getProvider(providerId)
  if (!provider) {
    return {
      ok: false,
      verified: false,
      message: `Unknown provider: ${providerId}.`,
    }
  }
  if (!provider.baseUrl) {
    return {
      ok: false,
      verified: false,
      message: `${provider.label} needs an endpoint before Tovyr can verify this key.`,
    }
  }

  const base = provider.baseUrl.replace(/\/+$/, '')
  const openAiCompatible = providerNeedsOpenAiCompat(provider)
  const urls = openAiCompatible
    ? Array.from(new Set([`${base}/models`, `${base}/v1/models`]))
    : [`${base}/v1/models`]
  const headers: Record<string, string> = openAiCompatible
    ? { Authorization: `Bearer ${apiKey}` }
    : {
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
  const statuses = (
    await Promise.all(
      urls.map(async url => {
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(8_000),
          })
          return response.status
        } catch {
          return null
        }
      }),
    )
  ).filter((status): status is number => status !== null)

  return classifyCredentialProbe(statuses, provider.label)
}
