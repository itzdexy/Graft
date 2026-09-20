/**
 * CLI: graft provider list | use <id> | model <id> | models [provider-id]
 */
import {
  PROVIDER_CATALOG,
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  listProvidersByCategory,
  setActiveModel,
  setActiveProvider,
} from './graft-providers.js'
import { persistActiveProvider } from './graft-prep-auth.js'
import {
  parseGlobalCliFlags,
  cliExit,
  cliUsage,
  isJsonMode,
  printProviderHelp,
  EXIT,
} from './graft-cli-ux.js'

const { argv } = parseGlobalCliFlags(process.argv.slice(2))
const [sub, arg] = argv

function buildGroups() {
  const groups = {}
  for (const [cat, providers] of Object.entries(listProvidersByCategory())) {
    groups[cat] = providers.map(p => ({
      id: p.id,
      label: p.label,
      active: p.id === getActiveProviderId(),
    }))
  }
  return groups
}

/** Widest value, so a long id (cloudflare_ai_gateway) cannot shear the column. */
function columnWidth(values) {
  let width = 0
  for (const value of values) width = Math.max(width, value.length)
  return width
}

export function formatProviderListLines(activeId = getActiveProviderId()) {
  const groups = buildGroups()
  const pad = columnWidth(
    Object.values(groups).flatMap(items => items.map(p => p.id)),
  )
  const lines = [
    `Active: ${activeId} · model ${getActiveModelId(activeId) || '(default)'}`
  ]
  for (const [cat, items] of Object.entries(groups)) {
    lines.push('')
    lines.push(cat)
    for (const p of items) {
      const marker = p.active ? ' *' : '  '
      lines.push(`${marker} ${p.id.padEnd(pad)}  ${p.label}`)
    }
  }
  lines.push('')
  lines.push('Switch: graft provider use <id>')
  lines.push('Model:  graft provider model <model-id>')
  lines.push('Models: graft provider models [provider-id]')
  return lines
}

function printList() {
  const active = getActiveProviderId()

  if (isJsonMode()) {
    cliExit(EXIT.OK, {
      data: {
        active,
        model: getActiveModelId(active) || null,
        groups: buildGroups(),
      },
    })
    return
  }

  console.log(formatProviderListLines(active).join('\n'))
}

/**
 * `graft models [provider]` / `graft provider models [provider]`.
 * Both spellings are advertised in --help but neither had a branch here, so
 * they fell through to the default case and exited 2 on a usage error.
 */
function printModels(providerId) {
  const id = providerId || getActiveProviderId()
  if (!PROVIDER_CATALOG[id]) {
    cliExit(EXIT.USAGE, {
      error: `Unknown provider "${id}". Run: graft provider list`,
    })
  }

  const provider = getProvider(id)
  const models = provider?.models ?? []
  const activeModel = getActiveModelId(id)

  if (isJsonMode()) {
    cliExit(EXIT.OK, {
      data: {
        provider: id,
        label: provider?.label || id,
        active: activeModel || null,
        models: models.map(m => ({
          id: m.id,
          label: m.label || m.id,
          tier: m.tier ?? null,
          active: m.id === activeModel,
        })),
      },
    })
    return
  }

  if (models.length === 0) {
    console.log(`No catalog models listed for ${provider?.label || id}.`)
    console.log('Set one directly: graft provider model <model-id>')
    return
  }

  console.log(
    `${provider?.label || id} · ${models.length} model${models.length === 1 ? '' : 's'}`,
  )
  // Providers with `anyModel` accept ids outside the curated list, so the
  // active one may match no row below. State it plainly instead of printing a
  // list with no marker and leaving the user to guess what is selected.
  if (activeModel) {
    const listed = models.some(m => m.id === activeModel)
    console.log(
      `Active: ${activeModel}${listed ? '' : '  (custom — not in the list below)'}`,
    )
  }
  console.log('')
  const pad = columnWidth(models.map(m => m.id))
  for (const m of models) {
    const marker = m.id === activeModel ? ' *' : '  '
    console.log(`${marker} ${m.id.padEnd(pad)}  ${m.label || m.id}`)
  }
  console.log('')
  console.log('Set: graft provider model <model-id>')
}

function printUse(id) {
  if (!id) {
    cliUsage('Usage: graft provider use <provider-id>')
  }
  if (!PROVIDER_CATALOG[id]) {
    cliExit(EXIT.USAGE, { error: `Unknown provider "${id}". Run: graft provider list` })
  }
  const before = getActiveProviderId()
  setActiveProvider(id)
  const active = persistActiveProvider()
  if (!active) {
    setActiveProvider(before)
    cliExit(EXIT.ERROR, {
      error: `No API key saved for provider "${id}". Run: graft auth login --provider ${id} --key <key>`,
    })
  }
  const p = getProvider(id)
  if (isJsonMode()) {
    cliExit(EXIT.OK, {
      data: {
        provider: id,
        label: p?.label || id,
        model: getActiveModelId(id) || p?.models?.[0]?.id || null,
      },
    })
    return
  }
  console.log(`Active provider: ${p?.label || id}`)
  console.log(`Model: ${getActiveModelId(id) || p?.models?.[0]?.id || 'default'}`)
}

function printModel(modelId) {
  if (!modelId) {
    cliUsage('Usage: graft provider model <model-id>')
  }
  const providerId = getActiveProviderId()
  try {
    setActiveModel(modelId, providerId)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    cliExit(EXIT.ERROR, { error: detail })
  }
  const active = persistActiveProvider()
  if (!active) {
    cliExit(EXIT.ERROR, {
      error: `No API key saved for provider "${providerId}". Run: graft auth login`,
    })
  }
  if (isJsonMode()) {
    cliExit(EXIT.OK, { data: { provider: providerId, model: modelId } })
    return
  }
  console.log(`Model for ${providerId}: ${modelId}`)
}

if (argv.includes('--help') || argv.includes('-h')) {
  printProviderHelp()
  process.exit(EXIT.OK)
}

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
    cliUsage(
      `Unknown command "${sub}".\n` +
        'Usage: graft provider [list|use <id>|model <id>|models [provider-id]]\n' +
        'Run: graft provider --help',
    )
}
