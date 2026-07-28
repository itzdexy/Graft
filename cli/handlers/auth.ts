/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handler intentionally exits */

import {
  TOVYR_CLI_NAME,
  TOVYR_PRODUCT_NAME,
  TOVYR_PROVIDER_NAME,
} from '../../constants/tovyr.js'
import { performLogout } from '../../commands/logout/logout.js'
import {
  getTovyrConnectionSummary,
  loginWithTovyrApiKey,
} from '../../services/tovyr/provider.js'
import {
  getAnthropicApiKeyWithSource,
  removeApiKey,
} from '../../utils/auth.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import { jsonStringify } from '../../utils/slowOperations.js'

export async function authLogin({
  key,
}: {
  key?: string
  email?: string
  sso?: boolean
  console?: boolean
  claudeai?: boolean
}): Promise<void> {
  if (!key) {
    process.stderr.write(
      `Provide your ${TOVYR_PROVIDER_NAME} API key:\n` +
        `  ${TOVYR_CLI_NAME} auth login --key fe_oa_...\n` +
        `Or run /login inside an interactive ${TOVYR_PRODUCT_NAME} session.\n`,
    )
    process.exit(1)
  }

  try {
    await loginWithTovyrApiKey(key)
    process.stdout.write(
      `${TOVYR_PRODUCT_NAME} connected to ${TOVYR_PROVIDER_NAME}.\n`,
    )
    process.exit(0)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Login failed: ${message}\n`)
    process.exit(1)
  }
}

export async function authStatus(opts: {
  json?: boolean
  text?: boolean
}): Promise<void> {
  const { key, source } = getAnthropicApiKeyWithSource()
  const loggedIn = !!key
  const connection = getTovyrConnectionSummary()

  if (opts.text) {
    if (loggedIn) {
      process.stdout.write(`Provider: ${connection ?? TOVYR_PROVIDER_NAME}\n`)
      process.stdout.write(`API key source: ${source}\n`)
    } else {
      process.stdout.write(
        `Not connected. Run ${TOVYR_CLI_NAME} auth login --key <api-key> or /login.\n`,
      )
    }
  } else {
    process.stdout.write(
      jsonStringify(
        {
          loggedIn,
          authMethod: loggedIn ? 'api_key' : 'none',
          apiProvider: getAPIProvider(),
          provider: connection,
          apiKeySource: loggedIn ? source : null,
        },
        null,
        2,
      ) + '\n',
    )
  }
  process.exit(loggedIn ? 0 : 1)
}

export async function authLogout(): Promise<void> {
  try {
    await performLogout({ clearOnboarding: false })
    await removeApiKey()
    delete process.env.ANTHROPIC_API_KEY
  } catch {
    process.stderr.write('Failed to log out.\n')
    process.exit(1)
  }
  process.stdout.write(`Disconnected from ${TOVYR_PROVIDER_NAME}.\n`)
  process.exit(0)
}

// Keep export for any legacy OAuth install paths still imported elsewhere.
export { installOAuthTokens } from './auth.oauth.js'
