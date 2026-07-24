/**
 * CLI: blink config — show active provider, model, and config file paths.
 */
import { join } from 'node:path'
import { BLINK_PRODUCT_NAME } from '../constants/blink.js'
import { getBlinkHome } from './blink-home.js'
import {
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  loadState,
  resolveActive,
} from './blink-providers.js'
import { getBlinkPackageRoot, resolveBlinkCliEntry } from './blink-package-root.js'
import { AGENT_LIMITS, formatAgentLimitsSummary } from './blink-agent-limits.js'
import {
  cliExit,
  isJsonMode,
  parseGlobalCliFlags,
  printConfigHelp,
  EXIT,
} from './blink-cli-ux.js'

const { argv } = parseGlobalCliFlags(process.argv.slice(2))
if (argv.includes('--help') || argv.includes('-h')) {
  printConfigHelp()
  process.exit(EXIT.OK)
}

const home = getBlinkHome()
const providersPath = join(home, '.blink', 'providers.json')
const legacyKeyPath = join(home, '.blink', 'api-key')
const providerId = getActiveProviderId()
const provider = getProvider(providerId)
const active = resolveActive()
const root = getBlinkPackageRoot()
const cliEntry = resolveBlinkCliEntry(root)
const state = loadState()
const activated = Object.keys(state.keys || {}).filter(id => {
  const p = getProvider(id, state)
  if (!p) return false
  const key = state.keys[id]
  return key && key.length >= 8
})

const envModel = process.env.BLINK_DEFAULT_MODEL?.trim()
const envKey = process.env.BLINK_API_KEY?.trim()
const envBase = process.env.BLINK_PROVIDER_BASE_URL?.trim()
const autoFailover = process.env.BLINK_AUTO_FAILOVER !== '0'
const crossProvider = process.env.BLINK_CROSS_PROVIDER_FAILOVER !== '0'
const sessionsDir = process.env.CLAUDE_CONFIG_DIR
  ? join(process.env.CLAUDE_CONFIG_DIR, 'projects')
  : join(home, '.claude', 'projects')

if (isJsonMode()) {
  cliExit(EXIT.OK, {
    data: {
      home: home || null,
      paths: {
        providers: providersPath,
        legacyKey: legacyKeyPath,
        packageRoot: root,
        uiEntry: cliEntry || null,
      },
      active: {
        providerId,
        providerLabel: provider?.label || providerId,
        model: getActiveModelId(providerId) || provider?.defaultModel || null,
        baseUrl: provider?.baseUrl || null,
        apiKeyConfigured: Boolean(active),
        notes: provider?.notes || null,
      },
      environment: {
        BLINK_API_KEY: Boolean(envKey),
        BLINK_DEFAULT_MODEL: envModel || null,
        BLINK_PROVIDER_BASE_URL: envBase || null,
        BLINK_AUTO_FAILOVER: autoFailover,
        BLINK_CROSS_PROVIDER_FAILOVER: crossProvider,
      },
      agentLimits: AGENT_LIMITS,
      sessionsDir,
      savedProviders: activated.map(id => ({
        id,
        label: getProvider(id, state)?.label || id,
        model: state.models?.[id] || null,
        active: id === providerId,
      })),
    },
  })
}

console.log(`${BLINK_PRODUCT_NAME} configuration\n`)

console.log('Paths')
console.log(`  Home:           ${home || '(unknown)'}`)
console.log(`  Providers:      ${providersPath}`)
console.log(`  Legacy key:     ${legacyKeyPath}`)
console.log(`  Package root:   ${root}`)
console.log(`  UI entry:       ${cliEntry || '(npm launcher — clone source for full UI)'}`)

console.log('\nActive provider')
console.log(`  Provider:       ${providerId}${provider ? ` (${provider.label})` : ''}`)
console.log(`  Model:          ${getActiveModelId(providerId) || provider?.defaultModel || '(default)'}`)
console.log(`  Base URL:       ${provider?.baseUrl || '(provider default)'}`)
if (provider?.notes) {
  console.log(`  Notes:          ${provider.notes}`)
}
console.log(
  `  API key:        ${active ? 'configured' : 'missing — run: blink auth login --key <key>'}`,
)

if (envModel || envKey || envBase) {
  console.log('\nEnvironment overrides')
  if (envKey) console.log('  BLINK_API_KEY              set (used for FreeModel)')
  if (envModel) console.log(`  BLINK_DEFAULT_MODEL        ${envModel}`)
  if (envBase) console.log(`  BLINK_PROVIDER_BASE_URL    ${envBase}`)
}

if (activated.length > 0) {
  console.log('\nSaved provider keys')
  for (const id of activated) {
    const p = getProvider(id, state)
    const model = state.models?.[id]
    const marker = id === providerId ? ' *' : '  '
    console.log(
      `${marker} ${id.padEnd(16)} ${p?.label || id}${model ? ` · ${model}` : ''}`,
    )
  }
}

console.log('\nReliability')
console.log(`  ${formatAgentLimitsSummary()}`)
console.log(
  `  Provider failover: ${autoFailover ? 'on' : 'off'} (same provider) · cross-provider: ${crossProvider ? 'on' : 'off'}`,
)
console.log(`  Sessions:       ${sessionsDir}`)

console.log('\nChange settings')
console.log('  blink provider list')
console.log('  blink provider use <id>')
console.log('  blink provider model <model-id>')
console.log('  blink models')
