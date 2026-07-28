/**
 * One-time setup: save FreeModel API key for Tovyr.
 * Usage: bun run scripts/setup-kairo-key.ts <api-key>
 */
import { enableConfigs } from '../utils/config.js'
import { applyTovyrProviderEnv, loginWithTovyrApiKey } from '../services/kairo/provider.js'

const apiKey = process.argv[2]?.trim()
if (!apiKey) {
  console.error('Usage: bun run scripts/setup-kairo-key.ts <fe_oa_...>')
  process.exit(1)
}

enableConfigs()
applyTovyrProviderEnv()

try {
  await loginWithTovyrApiKey(apiKey)
  console.log('Tovyr Code API key saved and verified.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
