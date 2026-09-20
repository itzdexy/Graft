import { describe, expect, test } from 'bun:test'
import type { CatalogModel } from './catalogModels.js'
import { buildModelPickerRows } from './modelPickerRows.js'

const models: CatalogModel[] = [
  { id: 'ready', label: 'Ready model', tier: 'opus' },
  { id: 'chat', label: 'Chat model', tier: 'sonnet' },
  { id: 'slow', label: 'Slow model', tier: 'sonnet' },
  { id: 'listed', label: 'Listed model', tier: 'haiku' },
  { id: 'embed-model', label: 'Embed model', tier: 'haiku' },
]

describe('buildModelPickerRows', () => {
  test('never describes inventory-only models as live or ready', () => {
    const rows = buildModelPickerRows({
      providerId: 'nvidia_nim',
      models,
      listedIds: new Set(models.map(model => model.id)),
      readiness: new Map(),
    })

    expect(rows.find(row => row.id === 'listed')?.state).toBe('listed')
    expect(rows.find(row => row.id === 'listed')?.description).toContain(
      'listed · unverified',
    )
  })

  test('projects readiness and capability limits into honest rows', () => {
    const rows = buildModelPickerRows({
      providerId: 'nvidia_nim',
      models,
      listedIds: new Set(models.map(model => model.id)),
      readiness: new Map([
        ['ready', { state: 'ready', supportsTools: true }],
        ['chat', { state: 'chat_only', supportsTools: false }],
        ['slow', { state: 'slow' }],
      ]),
    })

    expect(rows.find(row => row.id === 'ready')).toMatchObject({
      state: 'ready',
      selectable: true,
    })
    expect(rows.find(row => row.id === 'chat')).toMatchObject({
      state: 'chat_only',
      selectable: true,
    })
    expect(rows.find(row => row.id === 'slow')).toMatchObject({
      state: 'slow',
      selectable: true,
      needsConfirmation: true,
    })
    expect(rows.find(row => row.id === 'embed-model')).toMatchObject({
      state: 'unsuitable',
      selectable: false,
    })
  })
})
