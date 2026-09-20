/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handler intentionally exits */

import {
  GRAFT_CLI_NAME,
  GRAFT_PRODUCT_NAME,
} from '../../constants/graft.js'
import { performLogout } from '../../commands/logout/logout.js'
import {
  getGraftConnectionSummary,
  loginWithGraftApiKey,
} from '../../services/graft/provider.js'
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
      `Provide an API key for your configured provider:\n` +
        `  ${GRAFT_CLI_NAME} auth login --key <provider-api-key>\n` +
        `Or run /login inside an interactive ${GRAFT_PRODUCT_NAME} session.\n`,
    )
    process.exit(1)
  }

  try {
    await loginWithGraftApiKey(key)
    process.stdout.write(
      `${GRAFT_PRODUCT_NAME} provider connection saved.\n`,
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
  const connection = getGraftConnectionSummary()

  if (opts.text) {
    if (loggedIn) {
      process.stdout.write(`Provider: ${connection ?? 'configured provider'}\n`)
      process.stdout.write(`API key source: ${source}\n`)
    } else {
      process.stdout.write(
        `Not connected. Run ${GRAFT_CLI_NAME} auth login --key <api-key> or /login.\n`,
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
  process.stdout.write('Provider disconnected.\n')
  process.exit(0)
}

// Keep export for any legacy OAuth install paths still imported elsewhere.
export { installOAuthTokens } from './auth.oauth.js'
