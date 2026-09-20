import { expect, test } from 'bun:test'
import { isValidElement } from 'react'
import models, { call as modelsCall } from './models.js'
import provider, { call as providerCall } from './provider.js'
import type { LocalJSXCommandContext } from '../../commands.js'

test('model and provider loaders return callable dialogs without contacting an API', async () => {
  const context = { setAppState: () => {} } as unknown as LocalJSXCommandContext
  for (const [command, implementation] of [[models, modelsCall], [provider, providerCall]] as const) {
    const loaded = await command.load()
    expect(loaded.call).toBe(implementation)
    let dismissed = false
    const dialog = await loaded.call(() => { dismissed = true }, context, '')
    expect(isValidElement(dialog)).toBe(true)
    expect(dismissed).toBe(false)
  }
})
