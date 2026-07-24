/**
 * One-time setup: save FreeModel API key for Blink.
 * Usage: bun run scripts/setup-blink-key.ts <api-key>
 */
import { enableConfigs } from '../utils/config.js'
import { applyBlinkProviderEnv, loginWithBlinkApiKey } from '../services/blink/provider.js'

const apiKey = process.argv[2]?.trim()
if (!apiKey) {
  console.error('Usage: bun run scripts/setup-blink-key.ts <fe_oa_...>')
  process.exit(1)
}

enableConfigs()
applyBlinkProviderEnv()

try {
  await loginWithBlinkApiKey(apiKey)
  console.log('Blink API key saved and verified.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
