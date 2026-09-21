import { expect, test } from 'bun:test'
import { auditProviderModels } from './modelAudit.js'
import type { ModelDescriptor } from '../providers/types.js'

const models = ['chat-one', 'chat-two', 'chat-three', 'text-embedding'].map(id => ({ id, available: true, lifecycle: 'active' } as ModelDescriptor))
const deps = () => ({ ids: () => ['provider'], active: () => 'provider', selection: () => 'same', fetch: async () => models, state: () => 'live', probe: async () => ({ ok: true, latencyMs: 1, readiness: 'ready' as const }) })

test('catalog refresh never incurs inference calls and stale catalogs are not tested as live', async () => {
  const dependencies = deps()
  dependencies.probe = async () => { throw new Error('Must not run') }
  expect((await auditProviderModels({}, dependencies))[0]?.checked).toEqual([])
  dependencies.state = () => 'failed'
  expect((await auditProviderModels({ check: true }, dependencies))[0]?.checked).toEqual([])
})

test('checks filter non-chat models, obey limits, and distinguish timeouts', async () => {
  const dependencies = deps()
  let running = 0, maximum = 0
  const report = await auditProviderModels({ check: true, limit: 2 }, { ...dependencies, probe: async input => {
    maximum = Math.max(maximum, ++running)
    expect(input.forceInference).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 5))
    running--
    return { ok: false, latencyMs: 5, readiness: 'slow', errorKind: 'timeout' }
  } })
  expect(maximum).toBeLessThanOrEqual(2)
  expect(report[0]?.eligible).toBe(3)
  expect(report[0]?.checked.map(c => c.status)).toEqual(['timeout', 'timeout'])
  expect(report[0]?.stopped).toBe('requested limit')
})

test('rate limits stop new requests and cancellation remains inconclusive', async () => {
  const dependencies = deps()
  const limited = await auditProviderModels({ check: true }, { ...dependencies, probe: async () => ({ ok: false, latencyMs: 1, readiness: 'unknown', errorKind: 'rate_limit' }) })
  expect(limited[0]?.checked.length).toBeLessThanOrEqual(2)
  expect(limited[0]?.stopped).toBe('rate_limit')
  const controller = new AbortController()
  const cancelled = await auditProviderModels({ check: true, signal: controller.signal }, { ...dependencies, probe: async () => { controller.abort(); throw new Error('cancelled') } })
  expect(cancelled[0]?.checked).toEqual([])
  expect(cancelled[0]?.stopped).toBe('cancelled')
})
