import {
  getActiveProviderId,
  getProvider,
  getProviderApiKey,
  isValidKey,
  resolveActive,
  loadState,
} from '../../../scripts/graft-providers.js'
import { isLocalProvider } from '../../../scripts/graft-provider-local.js'

export type ProviderConfigIssue = {
  code:
    | 'unknown_provider'
    | 'missing_key'
    | 'invalid_key'
    | 'missing_base_url'
    | 'missing_model'
    | 'env_override'
  severity: 'error' | 'warning'
  message: string
  fix?: string
}

type State = ReturnType<typeof loadState>

export function validateProviderConfig(
  providerId: string = getActiveProviderId(),
  state?: State,
): ProviderConfigIssue[] {
  const issues: ProviderConfigIssue[] = []
  const provider = getProvider(providerId, state)
  if (!provider) {
    issues.push({
      code: 'unknown_provider',
      severity: 'error',
      message: `Unknown provider "${providerId}".`,
      fix: 'Run: graft provider list',
    })
    return issues
  }

  const needsUrl =
    provider.custom === true ||
    provider.id === 'openai' ||
    provider.id === 'litellm' ||
    provider.id === 'google'
  if (needsUrl && !provider.baseUrl) {
    issues.push({
      code: 'missing_base_url',
      severity: 'error',
      message: `${provider.label} requires a base URL.`,
      fix: 'Set endpoint in /provider url or providers.json endpoints field.',
    })
  }

  const apiKey = getProviderApiKey(providerId, state)
  if (isLocalProvider(provider)) {
    if (!provider.baseUrl) {
      issues.push({
        code: 'missing_base_url',
        severity: 'error',
        message: `${provider.label} needs a local base URL (default is preconfigured).`,
        fix: `Ensure ${provider.label} is running locally.`,
      })
    }
  } else if (!apiKey) {
    issues.push({
      code: 'missing_key',
      severity: 'error',
      message: `No API key saved for ${provider.label}.`,
      fix: `graft auth login --provider ${providerId} --key <your_key>`,
    })
  } else if (!isValidKey(provider, apiKey)) {
    issues.push({
      code: 'invalid_key',
      severity: 'error',
      message: `API key format looks invalid for ${provider.label}.`,
      fix: provider.keyHint
        ? `Expected format: ${provider.keyHint}`
        : 'Check your provider dashboard for the correct key format.',
    })
  }

  const envKey = process.env.GRAFT_API_KEY?.trim()
  if (envKey && providerId !== 'freemodel') {
    issues.push({
      code: 'env_override',
      severity: 'warning',
      message: 'GRAFT_API_KEY is set but only applies to FreeModel.',
      fix: 'Use graft auth login or /provider for other providers.',
    })
  }

  if (process.env.GRAFT_DEFAULT_MODEL?.trim()) {
    issues.push({
      code: 'env_override',
      severity: 'warning',
      message: `GRAFT_DEFAULT_MODEL overrides saved model (${process.env.GRAFT_DEFAULT_MODEL.trim()}).`,
    })
  }

  return issues
}

export function validateActiveProviderConfig(): ProviderConfigIssue[] {
  return validateProviderConfig(getActiveProviderId())
}

export function formatProviderConfigIssues(
  issues: ProviderConfigIssue[],
): string {
  if (issues.length === 0) return 'Provider configuration looks valid.'
  return issues
    .map(issue => {
      const prefix = issue.severity === 'error' ? '✗' : '!'
      const fix = issue.fix ? `\n    Fix: ${issue.fix}` : ''
      return `  ${prefix} ${issue.message}${fix}`
    })
    .join('\n')
}

export function assertResolvableActiveProvider(): {
  ok: true
  active: NonNullable<ReturnType<typeof resolveActive>>
} | {
  ok: false
  issues: ProviderConfigIssue[]
  message: string
} {
  const issues = validateActiveProviderConfig().filter(i => i.severity === 'error')
  const active = resolveActive()
  if (!active) {
    return {
      ok: false,
      issues,
      message: formatProviderConfigIssues(
        issues.length > 0
          ? issues
          : [
              {
                code: 'missing_key',
                severity: 'error',
                message: 'Active provider is not ready.',
                fix: 'graft auth login --key <your_key>',
              },
            ],
      ),
    }
  }
  if (issues.length > 0) {
    return {
      ok: false,
      issues,
      message: formatProviderConfigIssues(issues),
    }
  }
  return { ok: true, active }
}
