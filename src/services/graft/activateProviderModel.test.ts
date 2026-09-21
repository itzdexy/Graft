import { describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import { createGraftTestHome } from '../../../scripts/graft-test-home.js'
import { activateProviderModel } from './activateProviderModel.js'
import { setModelReadiness, clearModelReadiness } from './modelReadiness.js'

function runFailedDefaultCommit(state: Record<string, unknown>) {
  const testHome = createGraftTestHome()
  try {
    const providers = pathToFileURL(
      `${process.cwd()}/scripts/graft-providers.js`,
    ).href
    const activation = pathToFileURL(
      `${process.cwd()}/src/services/graft/activateProviderModel.ts`,
    ).href
    const program = [
      `import { loadState, saveState } from ${JSON.stringify(providers)}`,
      `import { activateProviderModel } from ${JSON.stringify(activation)}`,
      `saveState(${JSON.stringify(state)})`,
      "const result = await activateProviderModel({ providerId: 'freemodel', modelId: 'claude-sonnet-5' }, {",
      "  validate: async input => ({ ok: true, model: input.modelId, corrected: false }),",
      "  probe: async () => ({ ok: true, latencyMs: 1, readiness: 'ready' }),",
      "  apply: async () => { throw new Error('fixture session apply failed') },",
      '})',
      'console.log(JSON.stringify({ result, state: loadState() }))',
    ].join('\n')
    const result = Bun.spawnSync({
      cmd: [process.execPath, '-e', program],
      cwd: process.cwd(),
      env: { ...process.env, ...testHome.env },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(result.exitCode).toBe(0)
    return JSON.parse(result.stdout.toString())
  } finally {
    testHome.cleanup()
  }
}

describe('activateProviderModel', () => {
  test('failed selection suggests only observed successes without switching automatically', async () => {
    for (const [modelId, source] of [['responded', 'probe'], ['catalog-only', 'catalog']] as const) {
      setModelReadiness({providerId:'fixture',modelId,state:'ready',source,checkedAt:Date.now(),hardFailure:false})
    }
    try {
      let committed=false
      const result=await activateProviderModel({providerId:'fixture',modelId:'missing'},{
        validate:async input=>({ok:true,model:input.modelId,corrected:false}),
        probe:async()=>({ok:false,latencyMs:1,readiness:'unavailable',detail:'Endpoint unavailable.'}),
        commit:async()=>{committed=true},
      })
      expect(result.ok).toBe(false)
      if(!result.ok) {
        expect(result.message).toContain('Recent successful checks: "responded"')
        expect(result.message).not.toContain('catalog-only')
      }
      expect(committed).toBe(false)
    } finally {
      clearModelReadiness('fixture','responded'); clearModelReadiness('fixture','catalog-only')
    }
  })
  test('does not commit a candidate that times out', async () => {
    let committed = false

    const result = await activateProviderModel(
      { providerId: 'nvidia_nim', modelId: 'slow-model' },
      {
        validate: async input => ({
          ok: true,
          model: input.modelId,
          corrected: false,
        }),
        probe: async () => ({
          ok: false,
          latencyMs: 8_001,
          readiness: 'slow',
          detail: 'Timed out',
        }),
        commit: async () => {
          committed = true
        },
      },
    )

    expect(result).toMatchObject({ ok: false, readiness: 'slow' })
    expect(committed).toBe(false)
  })

  test('validates and probes before committing exactly once', async () => {
    const order: string[] = []

    const result = await activateProviderModel(
      { providerId: 'anthropic', modelId: 'claude-opus-5' },
      {
        validate: async input => {
          order.push('validate')
          return { ok: true, model: input.modelId, corrected: false }
        },
        probe: async () => {
          order.push('probe')
          return { ok: true, latencyMs: 120, readiness: 'ready' }
        },
        commit: async () => {
          order.push('commit')
        },
      },
    )

    expect(result).toEqual({
      ok: true,
      providerId: 'anthropic',
      modelId: 'claude-opus-5',
      readiness: 'ready',
    })
    expect(order).toEqual(['validate', 'probe', 'commit'])
  })

  test('requires explicit opt-in before activating a slow candidate', async () => {
    let committed = false

    const result = await activateProviderModel(
      {
        providerId: 'nvidia_nim',
        modelId: 'slow-model',
        allowSlow: true,
      },
      {
        validate: async input => ({
          ok: true,
          model: input.modelId,
          corrected: false,
        }),
        probe: async () => ({
          ok: false,
          latencyMs: 8_001,
          readiness: 'slow',
          detail: 'Timed out',
        }),
        commit: async () => {
          committed = true
        },
      },
    )

    expect(result).toMatchObject({ ok: true, readiness: 'slow' })
    expect(committed).toBe(true)
  })

  test('failure restores the candidate provider’s previous saved model', () => {
    const before = {
      schemaVersion: 1,
      active: 'ollama',
      keys: { cerebras: 'fixture-metadata-key' },
      models: {
        ollama: 'qwen2.5-coder:1.5b',
        freemodel: 'claude-haiku-4-5-20251001',
      },
      auth: {},
      custom: { baseUrl: '' },
      endpoints: {},
    }
    const output = runFailedDefaultCommit(before)

    expect(output.result.ok).toBe(false)
    expect(output.state).toEqual(before)
  })

  test('failure preserves candidate model absence and all saved metadata', () => {
    const before = {
      schemaVersion: 1,
      active: 'ollama',
      keys: { cerebras: 'fixture-metadata-key' },
      models: { ollama: 'qwen2.5-coder:1.5b' },
      auth: { cerebras: 'oauth' },
      custom: { baseUrl: 'http://127.0.0.1:7777', label: 'Fixture' },
      endpoints: { cerebras: 'https://fixture.invalid/v1' },
    }
    const output = runFailedDefaultCommit(before)

    expect(output.result.ok).toBe(false)
    expect(output.state).toEqual(before)
    expect(output.state.models.freemodel).toBeUndefined()
  })
})
