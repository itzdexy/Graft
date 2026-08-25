/**
 * CLI: tovyr provider list | use <id> | model <id>
 */
import {
  PROVIDER_CATALOG,
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  listProvidersByCategory,
  setActiveModel,
  setActiveProvider,
} from './tovyr-providers.js'
import { persistActiveProvider } from './tovyr-prep-auth.js'
import { parseGlobalCliFlags, cliExit, cliUsage, isJsonMode, EXIT } from './tovyr-cli-ux.js'

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

export function formatProviderListLines(activeId = getActiveProviderId()) {
  const groups = buildGroups()
  const lines = [
    `Active: ${activeId} · model ${getActiveModelId(activeId) || '(default)'}`
  ]
  for (const [cat, items] of Object.entries(groups)) {
    lines.push('')
    lines.push(cat)
    for (const p of items) {
      const marker = p.active ? ' *' : '  '
      lines.push(`${marker} ${p.id.padEnd(16)} ${p.label}`)
    }
  }
  lines.push('')
  lines.push('Switch: tovyr provider use <id>')
  lines.push('Model:  tovyr provider model <model-id>')
  return lines
}

function printList() {
  const active = getActiveProviderId()
  const groups = buildGroups()

  if (isJsonMode()) {
    cliExit(EXIT.OK, {
      data: {
        active,
        model: getActiveModelId(active) || null,
        groups,
      },
    })
    return
  }

  console.log(`Active: ${active} · model ${getActiveModelId(active) || '(default)'}`)
  console.log('')
  for (const [cat, items] of Object.entries(groups)) {
    console.log(cat)
    for (const p of items) {
      const marker = p.active ? ' *' : '  '
      console.log(`${marker} ${p.id.padEnd(16)} ${p.label}`)
    }
    console.log('')
  }
  console.log('Switch: tovyr provider use <id>')
  console.log('Model:  tovyr provider model <model-id>')
}

function printUse(id) {
  if (!id) {
    cliUsage('Usage: tovyr provider use <provider-id>')
  }
  if (!PROVIDER_CATALOG[id]) {
    cliExit(EXIT.USAGE, { error: `Unknown provider "${id}". Run: tovyr provider list` })
  }
  const before = getActiveProviderId()
  setActiveProvider(id)
  const active = persistActiveProvider()
  if (!active) {
    setActiveProvider(before)
    cliExit(EXIT.ERROR, {
      error: `No API key saved for provider "${id}". Run: tovyr auth login --provider ${id} --key <key>`,
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
    cliUsage('Usage: tovyr provider model <model-id>')
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
      error: `No API key saved for provider "${providerId}". Run: tovyr auth login`,
    })
  }
  if (isJsonMode()) {
    cliExit(EXIT.OK, { data: { provider: providerId, model: modelId } })
    return
  }
  console.log(`Model for ${providerId}: ${modelId}`)
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
  default:
    cliUsage('Usage: tovyr provider [list|use <id>|model <id>]\nRun: tovyr provider --help')
}
