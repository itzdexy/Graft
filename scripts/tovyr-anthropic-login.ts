import { createInterface } from 'node:readline'
import { installOAuthTokens } from '../cli/handlers/auth.oauth.js'
import {
  setActiveProvider,
  setProviderAuth,
} from './tovyr-providers.js'
import { OAuthService } from '../services/oauth/index.js'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Tovyr Anthropic account login

Opens the secure Anthropic authorization page in your default browser.
Credentials are stored under ~/.tovyr only. Tovyr never reads or changes
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
    'Anthropic connected to Tovyr. Credentials were saved in ~/.tovyr only.',
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Tovyr login failed: ${message}`)
  process.exitCode = 1
} finally {
  oauth.cleanup()
  input.close()
}
