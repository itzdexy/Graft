/**
 * CLI: blink provider list | use <id> | model <id> | models [provider-id]
 * Alias: blink models [provider-id]
 */
import {
  PROVIDER_CATALOG,
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  getProviderApiKey,
  isValidKey,
  listProviderCategoriesOrdered,
  setActiveModel,
  setActiveProvider,
} from './blink-providers.js'
import { persistActiveProvider } from './blink-prep-auth.js'
import { isLocalProvider } from './blink-provider-local.js'
import { formatModelCapabilityLine } from './blink-model-capabilities.js'
import {
  cliExit,
  isJsonMode,
  parseGlobalCliFlags,
  printProviderHelp,
  EXIT,
} from './blink-cli-ux.js'

const rawArgv = process.argv.slice(2)
const { argv } = parseGlobalCliFlags(rawArgv)
const sub = argv[0]
const arg = argv[1]

if (argv.includes('--help') || argv.includes('-h')) {
  printProviderHelp()
  process.exit(EXIT.OK)
}

/** @returns {string[]} */
export function formatProviderListLines(activeId = getActiveProviderId()) {
  const lines = [
    activeId
      ? `Active: ${activeId} · model ${getActiveModelId(activeId) || '(default)'}`
      : 'Active: none · choose a provider before your first prompt',
    '',
  ]
  for (const group of listProviderCategoriesOrdered()) {
    lines.push(group.id)
    for (const provider of group.providers) {
      const marker = provider.id === activeId ? ' *' : '  '
      lines.push(`${marker} ${provider.id.padEnd(16)} ${provider.label}`)
    }
    lines.push('')
  }
  lines.push('Switch: blink provider use <id>')
  lines.push('Model:  blink provider model <model-id>')
  return lines
}

function printList() {
  if (isJsonMode()) {
    const activeId = getActiveProviderId()
    const groups = listProviderCategoriesOrdered().map(group => ({
      id: group.id,
      providers: group.providers.map(p => ({
        id: p.id,
        label: p.label,
        active: p.id === activeId,
      })),
    }))
    cliExit(EXIT.OK, {
      data: {
        activeProvider: activeId,
        activeModel: getActiveModelId(activeId) || null,
        groups,
      },
    })
  }
  console.log(formatProviderListLines().join('\n'))
}

function printUse(id) {
  if (!id) {
    console.error('Usage: blink provider use <provider-id>')
    console.error('Example: blink provider use openrouter')
    process.exit(EXIT.USAGE)
  }
  if (!PROVIDER_CATALOG[id]) {
    console.error(`Unknown provider "${id}".`)
    console.error('Run: blink provider list')
    process.exit(EXIT.ERROR)
  }
  const p = getProvider(id)
  if (!isLocalProvider(p)) {
    const apiKey = getProviderApiKey(id)
    if (!isValidKey(p, apiKey)) {
      console.error(`No API key saved for ${p?.label || id}.`)
      console.error(`Run: blink auth login --provider ${id} --key <your_key>`)
      process.exit(EXIT.ERROR)
    }
  }
  setActiveProvider(id)
  const active = persistActiveProvider()
  if (!active) {
    console.error(`Could not activate ${p?.label || id}.`)
    console.error('Check: blink config')
    process.exit(EXIT.ERROR)
  }
  const model = getActiveModelId(id) || p?.models?.[0]?.id || 'default'
  if (isJsonMode()) {
    cliExit(EXIT.OK, {
      data: { providerId: id, label: p?.label || id, model },
      message: `Active provider: ${p?.label || id} · model ${model}`,
    })
  }
  console.log(`Active provider: ${p?.label || id}`)
  console.log(`Model: ${model}`)
}

function printModel(modelId) {
  if (!modelId) {
    console.error('Usage: blink provider model <model-id>')
    console.error('Example: blink provider model anthropic/claude-sonnet-4')
    process.exit(EXIT.USAGE)
  }
  const providerId = getActiveProviderId()
  try {
    setActiveModel(modelId, providerId)
    const active = persistActiveProvider()
    if (!active) {
      console.error(`Model saved for ${providerId}, but no API key is configured.`)
      console.error('Run: blink auth login --key <your_key>')
      process.exit(EXIT.ERROR)
    }
    if (isJsonMode()) {
      cliExit(EXIT.OK, {
        data: { providerId, modelId },
        message: `Model for ${providerId}: ${modelId}`,
      })
    }
    console.log(`Model for ${providerId}: ${modelId}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(EXIT.ERROR)
  }
}

function printModels(providerId) {
  const id = providerId || getActiveProviderId()
  const provider = getProvider(id)
  if (!provider) {
    console.error(`Unknown provider "${id}".`)
    console.error('Run: blink provider list')
    process.exit(EXIT.ERROR)
  }
  const activeModel = getActiveModelId(id)
  if (isJsonMode()) {
    cliExit(EXIT.OK, {
      data: {
        providerId: id,
        label: provider.label,
        baseUrl: provider.baseUrl || null,
        activeModel: activeModel || provider.defaultModel || null,
        models: (provider.models || []).map(m => ({
          id: m.id,
          label: m.label,
          tier: m.tier || null,
          context: m.context || null,
          capabilities: formatModelCapabilityLine(m.id),
          active: m.id === activeModel,
        })),
        anyModel: Boolean(provider.anyModel),
      },
    })
  }
  console.log(`${provider.label} (${id})`)
  console.log(`Base: ${provider.baseUrl || '(custom endpoint)'}\n`)
  if (!provider.models?.length) {
    console.log('No curated model list — set any model id:')
    console.log(`  blink provider model <model-id>`)
    if (provider.anyModel) {
      console.log('This gateway accepts thousands of model ids from its catalog.')
    }
    return
  }
  for (const m of provider.models) {
    const marker = m.id === activeModel ? ' *' : '  '
    const tier = m.tier ? ` [${m.tier}]` : ''
    const ctx = m.context ? ` · ${m.context}` : ''
    const caps = formatModelCapabilityLine(m.id)
    console.log(`${marker} ${m.id.padEnd(30)} ${m.label}${tier}${ctx}`)
    console.log(`${' '.repeat(4)}${caps}`)
  }
  if (provider.anyModel) {
    console.log('\nGateway accepts any model id: blink provider model <id>')
  }
  console.log(`\nActive model: ${activeModel || provider.defaultModel || '(default)'}`)
  console.log('Switch: blink provider model <model-id>')
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('blink-provider-cli.js') ||
    process.argv[1].endsWith('blink-provider-cli.mjs'))

if (isMain) {
  switch (sub) {
    case 'list':
    case undefined:
      printList()
      break
    case 'use':
      printUse(arg)
      break
    case 'model':
      printModel(arg)
      break
    case 'models':
      printModels(arg)
      break
    default:
      console.error('Usage: blink provider <list|use|model|models>')
      console.error('Run: blink provider --help')
      process.exit(EXIT.USAGE)
  }
}
