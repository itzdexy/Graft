import { describe, expect, test } from 'bun:test'
import { getAppAdapter, listAppAdapters } from './catalog.js'
import { createApplicationManager } from './operations.js'

function makeDeps(overrides = {}) {
  const calls = { gateways: [], spawns: [], stops: [] }
  const choices = [{
    id: 'openrouter::openai/gpt-5',
    providerId: 'openrouter',
    modelId: 'openai/gpt-5',
    providerLabel: 'OpenRouter',
    label: 'GPT-5',
  }]
  const deps = {
    calls,
    discover: adapter => ({ ...adapter, executable: adapter.integrationKind === 'model-routing' ? '/usr/bin/' + adapter.command : null, readiness: adapter.readiness }),
    state: {
      readConnection: () => null,
      saveConnection: record => record,
      removeConnection: id => ({ removed: true, appId: id }),
      restoreBackup: id => ({ restored: true, appId: id }),
    },
    startGateway: async options => {
      calls.gateways.push(options)
      return { token: 'redacted-test-token', child: { pid: 42 }, host: '127.0.0.1', port: 11434 }
    },
    stopGateway: async gateway => calls.stops.push(gateway),
    spawnClient: async (appId, args, context) => calls.spawns.push({ appId, args, context }),
    connectedModelChoices: () => choices,
    now: () => '2026-08-27T00:00:00.000Z',
  }
  return { ...deps, ...overrides }
}

describe('Tovyr application manager operations', () => {
  test('launches ready Codex through one selected qualified model', async () => {
    const deps = makeDeps()
    const manager = createApplicationManager(deps)
    const result = await manager.launch('codex', deps.connectedModelChoices()[0], [])
    expect(result).toMatchObject({ kind: 'launched', appId: 'codex', qualifiedModel: 'openrouter::openai/gpt-5', persistent: false })
    expect(deps.calls.gateways).toEqual([{ persistent: false }])
    expect(deps.calls.spawns[0].appId).toBe('codex')
    expect(deps.calls.spawns[0].args).toContain('openrouter::openai/gpt-5')
  })

  test('returns a tool-only explanation instead of launching Claude Desktop', async () => {
    const deps = makeDeps()
    const manager = createApplicationManager(deps)
    const result = await manager.launch('claude-desktop', deps.connectedModelChoices()[0], [])
    expect(result).toMatchObject({ kind: 'tool-only', command: 'tovyr mcp serve' })
    expect(deps.calls.gateways).toEqual([])
    expect(deps.calls.spawns).toEqual([])
  })

  test('returns a safe OpenAI-compatible recipe for manual clients', async () => {
    const manager = createApplicationManager(makeDeps())
    const result = await manager.configure('hermes-agent', {
      id: 'openrouter::openai/gpt-5', providerId: 'openrouter', modelId: 'openai/gpt-5',
    })
    expect(result).toMatchObject({ kind: 'manual-setup', endpoint: 'http://127.0.0.1:11434/v1', protocol: 'openai-compatible' })
    expect(JSON.stringify(result)).not.toMatch(/sk-|api[_-]?key/i)
  })

  test('reports Claude Desktop as tool-only with an actionable MCP command', async () => {
    const manager = createApplicationManager(makeDeps())
    expect(await manager.doctor('claude-desktop')).toMatchObject({
      readiness: 'tool-only', recoveryCommand: 'tovyr mcp serve',
    })
  })

  test('launches ChatGPT with a persistent gateway', async () => {
    const deps = makeDeps()
    const manager = createApplicationManager(deps)
    const result = await manager.launch('chatgpt', deps.connectedModelChoices()[0], [])
    expect(result).toMatchObject({ kind: 'launched', persistent: true })
    expect(deps.calls.gateways).toEqual([{ persistent: true }])
  })

  test('stops only a gateway created for a failed client spawn', async () => {
    const deps = makeDeps({
      spawnClient: async () => { throw new Error('spawn failed') },
    })
    const manager = createApplicationManager(deps)
    await expect(manager.launch('codex', deps.connectedModelChoices()[0], [])).rejects.toThrow('spawn failed')
    expect(deps.calls.stops.length).toBe(1)
  })

  test('does not stop a reused gateway after a failed spawn', async () => {
    const deps = makeDeps({
      startGateway: async options => { deps.calls.gateways.push(options); return { token: 'reused', child: null } },
      spawnClient: async () => { throw new Error('spawn failed') },
    })
    const manager = createApplicationManager(deps)
    await expect(manager.launch('codex', deps.connectedModelChoices()[0], [])).rejects.toThrow('spawn failed')
    expect(deps.calls.stops.length).toBe(0)
  })

  test('cleans up a temporary gateway after a client exits normally', async () => {
    const deps = makeDeps()
    const manager = createApplicationManager(deps)
    await manager.launch('codex', deps.connectedModelChoices()[0], [])
    expect(deps.calls.stops.length).toBe(1)
  })

  test('lists all catalog applications through discovery', async () => {
    const manager = createApplicationManager(makeDeps())
    const result = await manager.list()
    expect(result.map(item => item.id)).toEqual(listAppAdapters().map(item => item.id))
  })
})
