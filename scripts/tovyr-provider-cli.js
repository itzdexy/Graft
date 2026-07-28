/**
 * CLI: kairo provider list | use <id> | model <id>
 */
import {
  PROVIDER_CATALOG,
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  listProvidersByCategory,
  setActiveModel,
  setActiveProvider,
} from './kairo-providers.js'
import { persistActiveProvider } from './kairo-prep-auth.js'

const [, , sub, arg] = process.argv

function printList() {
  const active = getActiveProviderId()
  console.log(`Active: ${active} · model ${getActiveModelId(active) || '(default)'}\n`)
  for (const [cat, ids] of Object.entries(listProvidersByCategory())) {
    console.log(cat)
    for (const id of ids) {
      const p = getProvider(id)
      if (!p) continue
      const marker = id === active ? ' *' : '  '
      console.log(`${marker} ${id.padEnd(16)} ${p.label}`)
    }
    console.log('')
  }
  console.log('Switch: kairo provider use <id>')
  console.log('Model:  kairo provider model <model-id>')
}

function printUse(id) {
  if (!id) {
    console.error('Usage: kairo provider use <provider-id>')
    process.exit(1)
  }
  if (!PROVIDER_CATALOG[id]) {
    console.error(`Unknown provider "${id}". Run: kairo provider list`)
    process.exit(1)
  }
  setActiveProvider(id)
  persistActiveProvider()
  const p = getProvider(id)
  console.log(`Active provider: ${p?.label || id}`)
  console.log(`Model: ${getActiveModelId(id) || p?.models?.[0]?.id || 'default'}`)
}

function printModel(modelId) {
  if (!modelId) {
    console.error('Usage: kairo provider model <model-id>')
    process.exit(1)
  }
  const providerId = getActiveProviderId()
  setActiveModel(modelId, providerId)
  persistActiveProvider()
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
    console.error('Usage: kairo provider [list|use <id>|model <id>]')
    process.exit(1)
}
