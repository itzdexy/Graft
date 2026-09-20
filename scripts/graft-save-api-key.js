/**
 * Save an API key for the active Graft provider.
 * Usage:
 *   node scripts/graft-save-api-key.js <key>            # save to active provider
 *   node scripts/graft-save-api-key.js <provider> <key> # save to a named provider
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { prepareGraftAuth } from './graft-prep-auth.js'
import {
  PROVIDER_CATALOG,
  getActiveProviderId,
  getProvider,
  isValidKey,
  setProviderKey,
  setActiveProvider,
} from './graft-providers.js'

const args = process.argv.slice(2).filter(Boolean)
let providerId
let apiKey

if (args.length >= 2 && PROVIDER_CATALOG[args[0]]) {
  providerId = args[0]
  apiKey = args[1].trim()
} else {
  providerId = getActiveProviderId()
  apiKey = (args[0] || '').trim()
  if (!providerId) {
    const matches = Object.values(PROVIDER_CATALOG).filter(provider =>
      provider.keyPrefix && apiKey.startsWith(provider.keyPrefix),
    )
    if (matches.length === 1) {
      providerId = matches[0].id
    }
  }
}

const provider = getProvider(providerId)
if (!provider) {
  console.error('No provider selected.')
  console.error('Use: graft auth login --provider <id> --key <your_key>')
  console.error('List: graft provider list')
  process.exit(1)
}

if (!isValidKey(provider, apiKey)) {
  const hint = provider.keyHint || 'your key'
  console.error(`Invalid key for ${provider.label}. Expected ${hint}`)
  console.error(`Usage: graft auth login --key ${hint}`)
  if (provider.signup) console.error(`Get a key: ${provider.signup}`)
  process.exit(1)
}

// Persist key, make this provider active, and keep the legacy file in sync.
setProviderKey(providerId, apiKey)
setActiveProvider(providerId)

if (providerId === 'freemodel') {
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const graftDir = join(home, '.graft')
  if (!existsSync(graftDir)) mkdirSync(graftDir, { recursive: true })
  writeFileSync(join(graftDir, 'api-key'), apiKey, { mode: 0o600 })
  process.env.GRAFT_API_KEY = apiKey
}

prepareGraftAuth()
const model = provider.defaultModel ? ` · model ${provider.defaultModel}` : ''
console.log(`Connected to ${provider.label}${model}.`)
console.log('Next: cd your-project && graft')
console.log('Switch anytime: graft provider list · /provider in chat')
