import { getTovyrHome } from '../tovyr-package-root.js'
import { getAppAdapter, getLocalEndpoint, listAppAdapters } from './catalog.js'
import { discoverApp, resolveProductionRuntime } from './discovery.js'
import { createManagedState } from './managed-state.js'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 11434

function asPromise(value) {
  return value && typeof value.then === 'function' ? value : Promise.resolve(value)
}

function selectionId(selection) {
  if (typeof selection === 'string') return selection
  return selection?.id || selection?.qualifiedModel || null
}

async function resolveSelection(selection, deps) {
  const choices = await asPromise(deps.connectedModelChoices?.() || [])
  const requested = selectionId(selection)
  if (requested) {
    const found = choices.find(choice => choice.id === requested)
    if (found) return found
    if (selection?.providerId && selection?.modelId) {
      const qualified = `${selection.providerId}::${selection.modelId}`
      const qualifiedChoice = choices.find(choice => choice.id === qualified)
      if (qualifiedChoice) return qualifiedChoice
      return { ...selection, id: qualified }
    }
    if (requested.includes('::')) return { ...(selection || {}), id: requested }
    throw new Error(`Model "${requested}" is not available on a connected Tovyr provider.`)
  }
  return choices[0] || null
}

function manualRecipe(adapter, choice) {
  const endpoint = adapter.endpointPath || getLocalEndpoint(adapter.protocol)
  const qualifiedModel = choice?.id || null
  const modelLine = qualifiedModel || adapter.modelFormat || '<provider>::<model>'
  return {
    kind: 'manual-setup',
    appId: adapter.id,
    endpoint,
    protocol: adapter.protocol,
    model: modelLine,
    modelFormat: adapter.modelFormat || '<provider>::<model>',
    auth: 'Use a local Tovyr gateway token only when loopback authentication is enabled.',
    instructions: [
      `Base URL: ${endpoint}`,
      `Model: ${modelLine}`,
      'Keep this client in manual setup until its current official configuration contract is verified.',
    ],
    reason: adapter.recovery || null,
  }
}

function toolOnlyResult(adapter) {
  return {
    kind: 'tool-only',
    appId: adapter.id,
    command: 'tovyr mcp serve',
    reason: adapter.note || adapter.recovery || 'This client exposes tools through MCP rather than a custom model endpoint.',
  }
}

function unavailableResult(status) {
  return {
    kind: 'unavailable',
    appId: status.id,
    readiness: status.readiness,
    reason: status.reason || `Install or configure ${status.label} before launching it through Tovyr.`,
  }
}

function defaultClientArgs(adapter, qualifiedModel, passthrough) {
  if (adapter.id === 'codex') {
    return [
      '--oss', '--local-provider', 'tovyr', '-m', qualifiedModel,
      '-c', 'notify=[]',
      '-c', 'mcp_servers.hf-mcp-server.enabled=false',
      '-c', 'mcp_servers.mobbin.enabled=false',
      '-c', 'mcp_servers.Roblox_Studio.enabled=false',
      ...passthrough,
    ]
  }
  return [...passthrough]
}

function defaultClientEnv(adapter, gateway, baseEnv) {
  const env = { ...(baseEnv || process.env) }
  if (adapter.id === 'claude-code') {
    for (const key of ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL']) delete env[key]
    env.ANTHROPIC_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`
    env.ANTHROPIC_API_KEY = gateway.token
  } else {
    env.TOVYR_GATEWAY_TOKEN = gateway.token
  }
  return env
}

export function createApplicationManager(dependencies = {}) {
  const runtime = dependencies.runtime || resolveProductionRuntime()
  const deps = {
    discover: adapter => discoverApp(adapter, runtime),
    state: createManagedState(getTovyrHome()),
    connectedModelChoices: () => [],
    startGateway: async () => { throw new Error('No Tovyr gateway controller was provided.') },
    stopGateway: async gateway => gateway?.child?.kill?.(),
    spawnClient: async () => { throw new Error('No application launcher was provided.') },
    now: () => new Date().toISOString(),
    env: process.env,
    ...dependencies,
  }

  async function status(id) {
    const adapter = getAppAdapter(id)
    if (!adapter) return { id: String(id ?? ''), readiness: 'missing', reason: 'Unknown Tovyr application id.' }
    return asPromise(deps.discover(adapter))
  }

  async function list() {
    return Promise.all(listAppAdapters().map(adapter => asPromise(deps.discover(adapter))))
  }

  async function configure(id, selection) {
    const current = await status(id)
    if (!getAppAdapter(id)) return current
    if (current.readiness === 'tool-only' || current.integrationKind === 'tool-only') return toolOnlyResult(current)
    if (current.readiness === 'missing' || current.readiness === 'unsupported-version') return unavailableResult(current)
    const choice = await resolveSelection(selection, deps)
    // External configuration is intentionally not mutated until an adapter
    // provides a verified patch contract. Return a copyable recipe for now.
    return manualRecipe(current, choice)
  }

  async function launch(id, selection, passthrough = []) {
    const current = await status(id)
    if (!getAppAdapter(id)) return current
    if (current.readiness === 'tool-only' || current.integrationKind === 'tool-only') return toolOnlyResult(current)
    if (current.integrationKind === 'manual-setup' || current.readiness === 'manual-setup') return manualRecipe(current, await resolveSelection(selection, deps))
    if (current.readiness !== 'ready' || !current.executable) return unavailableResult(current)

    const choice = await resolveSelection(selection, deps)
    if (!choice?.id) throw new Error(`No connected Tovyr model selected for ${current.label}.`)
    const persistent = current.id === 'chatgpt'
    const gateway = await deps.startGateway({ persistent })
    try {
      const args = deps.buildClientArgs
        ? deps.buildClientArgs(current, choice.id, passthrough)
        : defaultClientArgs(current, choice.id, passthrough)
      const env = deps.buildClientEnv
        ? deps.buildClientEnv(current, gateway, deps.env, choice.id)
        : defaultClientEnv(current, gateway, deps.env)
      await deps.spawnClient(current.id, args, {
        executable: current.executable,
        qualifiedModel: choice.id,
        gateway: { host: gateway.host || DEFAULT_HOST, port: gateway.port || DEFAULT_PORT },
        env,
        passthrough,
      })
      if (!persistent && gateway?.child) await deps.stopGateway(gateway)
      return {
        kind: 'launched',
        appId: current.id,
        qualifiedModel: choice.id,
        gateway: { host: gateway.host || DEFAULT_HOST, port: gateway.port || DEFAULT_PORT },
        persistent,
      }
    } catch (error) {
      // A reused gateway has no child, so it is never stopped by a failed
      // launch attempt. Only clean up a process started by this operation.
      if (gateway?.child) await deps.stopGateway(gateway)
      throw error
    }
  }

  async function disconnect(id) {
    const app = getAppAdapter(id)
    if (!app) return { error: 'unknown-app', appId: String(id ?? '') }
    return deps.state.removeConnection(app.id)
  }

  async function restore(id) {
    const app = getAppAdapter(id)
    if (!app) return { error: 'unknown-app', appId: String(id ?? '') }
    return deps.state.restoreBackup(app.id)
  }

  async function doctor(id) {
    const current = await status(id)
    if (!getAppAdapter(id)) return current
    const result = { ...current }
    if (current.integrationKind === 'tool-only' || current.readiness === 'tool-only') {
      result.recoveryCommand = 'tovyr mcp serve'
    } else if (current.readiness === 'manual-setup') {
      result.recoveryCommand = `tovyr apps configure ${current.id}`
      result.endpoint = current.endpointPath || getLocalEndpoint(current.protocol)
    } else if (current.readiness !== 'ready') {
      result.recoveryCommand = current.recovery || `tovyr apps status ${current.id}`
    }
    return result
  }

  async function models() {
    return asPromise(deps.connectedModelChoices?.() || [])
  }

  return { list, status, configure, launch, disconnect, restore, doctor, models }
}
