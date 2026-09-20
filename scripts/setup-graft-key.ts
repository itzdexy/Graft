/**
 * One-time setup: save FreeModel API key for Graft.
 * Usage: bun run scripts/setup-graft-key.ts <api-key>
 */
import { enableConfigs } from '../src/utils/config.js'
import { applyGraftProviderEnv, loginWithGraftApiKey } from '../src/services/graft/provider.js'

const apiKey = process.argv[2]?.trim()
if (!apiKey) {
  console.error('Usage: bun run scripts/setup-graft-key.ts <fe_oa_...>')
  process.exit(1)
}

enableConfigs()
applyGraftProviderEnv()

try {
  await loginWithGraftApiKey(apiKey)
  console.log('Graft API key saved and verified.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
