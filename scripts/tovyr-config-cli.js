/**
 * CLI: tovyr config — show active provider, model, and config file paths.
 */
import { join } from 'node:path'
import { TOVYR_PRODUCT_NAME } from '../src/constants/tovyr.js'
import { getTovyrHome } from './tovyr-home.js'
import {
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  loadState,
  resolveActive,
} from './tovyr-providers.js'
import { getTovyrPackageRoot, resolveTovyrCliEntry } from './tovyr-package-root.js'
import { AGENT_LIMITS, formatAgentLimitsSummary } from './tovyr-agent-limits.js'
import {
  cliExit,
  isJsonMode,
  parseGlobalCliFlags,
  printConfigHelp,
  EXIT,
} from './tovyr-cli-ux.js'

const { argv } = parseGlobalCliFlags(process.argv.slice(2))
if (argv.includes('--help') || argv.includes('-h')) {
  printConfigHelp()
  process.exit(EXIT.OK)
}

const home = getTovyrHome()
const providersPath = join(home, '.tovyr', 'providers.json')
const legacyKeyPath = join(home, '.tovyr', 'api-key')
const providerId = getActiveProviderId()
const provider = getProvider(providerId)
const active = resolveActive()
const root = getTovyrPackageRoot()
const cliEntry = resolveTovyrCliEntry(root)
const state = loadState()
const activated = Object.keys(state.keys || {}).filter(id => {
  const p = getProvider(id, state)
  if (!p) return false
  const key = state.keys[id]
  return key && key.length >= 8
})

const envModel = process.env.TOVYR_DEFAULT_MODEL?.trim()
const envKey = process.env.TOVYR_API_KEY?.trim()
const envBase = process.env.TOVYR_PROVIDER_BASE_URL?.trim()
const autoFailover = process.env.TOVYR_AUTO_FAILOVER !== '0'
const crossProvider = process.env.TOVYR_CROSS_PROVIDER_FAILOVER !== '0'
const sessionsDir = process.env.CLAUDE_CONFIG_DIR
  ? join(process.env.CLAUDE_CONFIG_DIR, 'projects')
  : join(home, '.tovyr', 'projects')

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
        connected: Boolean(active),
        authMode: active?.authMode || null,
        apiKeyConfigured: Boolean(active?.apiKey),
        notes: provider?.notes || null,
      },
      environment: {
        TOVYR_API_KEY: Boolean(envKey),
        TOVYR_DEFAULT_MODEL: envModel || null,
        TOVYR_PROVIDER_BASE_URL: envBase || null,
        TOVYR_AUTO_FAILOVER: autoFailover,
        TOVYR_CROSS_PROVIDER_FAILOVER: crossProvider,
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

console.log(`${TOVYR_PRODUCT_NAME} configuration\n`)

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
if (active?.authMode === 'oauth') {
  console.log(
    `  Authentication: OAuth (${providerId === 'openai' ? 'official Codex transport' : 'Tovyr secure storage'})`,
  )
} else {
  console.log(
    `  API key:        ${active ? 'configured' : 'missing — run: tovyr auth login --key <key>'}`,
  )
}

if (envModel || envKey || envBase) {
  console.log('\nEnvironment overrides')
  if (envKey) console.log('  TOVYR_API_KEY              set (used for FreeModel)')
  if (envModel) console.log(`  TOVYR_DEFAULT_MODEL        ${envModel}`)
  if (envBase) console.log(`  TOVYR_PROVIDER_BASE_URL    ${envBase}`)
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
console.log('  tovyr provider list')
console.log('  tovyr provider use <id>')
console.log('  tovyr provider model <model-id>')
console.log('  tovyr models')
