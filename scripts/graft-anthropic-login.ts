import { createInterface } from 'node:readline'
import { installOAuthTokens } from '../src/cli/handlers/auth.oauth.js'
import {
  setActiveProvider,
  setProviderAuth,
} from './graft-providers.js'
import { OAuthService } from '../src/services/oauth/index.js'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Graft Anthropic account login

Opens the secure Anthropic authorization page in your default browser.
Credentials are stored under ~/.graft only. Graft never reads or changes
Claude Code's ~/.claude configuration or credentials.`)
  process.exit(0)
}

const input = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
})
const oauth = new OAuthService()

try {
  console.log('Opening a secure Anthropic login in your browser…')
  const tokens = await oauth.startOAuthFlow(
    async manualUrl => {
      console.log(
        `If the browser does not open, use this link:\n${manualUrl}\n\n` +
          'Paste the authorization code here only if the browser asks you to:',
      )
      input.once('line', value => {
        const [authorizationCode, state] = value.trim().split('#')
        if (authorizationCode && state) {
          oauth.handleManualAuthCodeInput({ authorizationCode, state })
        }
      })
    },
    { loginWithClaudeAi: true },
  )

  await installOAuthTokens(tokens)
  setProviderAuth('anthropic', 'oauth')
  setActiveProvider('anthropic')
  console.log(
    'Anthropic connected to Graft. Credentials were saved in ~/.graft only.',
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Graft login failed: ${message}`)
  process.exitCode = 1
} finally {
  oauth.cleanup()
  input.close()
}
