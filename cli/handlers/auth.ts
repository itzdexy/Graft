/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handler intentionally exits */

import {
  BLINK_CLI_NAME,
  BLINK_PRODUCT_NAME,
  BLINK_PROVIDER_NAME,
} from '../../constants/blink.js'
import { performLogout } from '../../commands/logout/logout.js'
import {
  getBlinkConnectionSummary,
  loginWithBlinkApiKey,
} from '../../services/blink/provider.js'
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
      `Provide your ${BLINK_PROVIDER_NAME} API key:\n` +
        `  ${BLINK_CLI_NAME} auth login --key fe_oa_...\n` +
        `Or run /login inside an interactive ${BLINK_PRODUCT_NAME} session.\n`,
    )
    process.exit(1)
  }

  try {
    await loginWithBlinkApiKey(key)
    process.stdout.write(
      `${BLINK_PRODUCT_NAME} connected to ${BLINK_PROVIDER_NAME}.\n`,
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
  const connection = getBlinkConnectionSummary()

  if (opts.text) {
    if (loggedIn) {
      process.stdout.write(`Provider: ${connection ?? BLINK_PROVIDER_NAME}\n`)
      process.stdout.write(`API key source: ${source}\n`)
    } else {
      process.stdout.write(
        `Not connected. Run ${BLINK_CLI_NAME} auth login --key <api-key> or /login.\n`,
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
  process.stdout.write(`Disconnected from ${BLINK_PROVIDER_NAME}.\n`)
  process.exit(0)
}

// Keep export for any legacy OAuth install paths still imported elsewhere.
export { installOAuthTokens } from './auth.oauth.js'
