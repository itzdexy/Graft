/**
 * Launch/configure third-party clients against Tovyr's shared gateway.
 * This file stays in the Node launcher layer so "tovyr codex" works before
 * the full Ink runtime is loaded.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getTovyrHome, resolveBunExecutable } from './tovyr-package-root.js'
import {
  getActiveModelId,
  getActiveProviderId,
  getProvider,
  listActivatedProviderIds,
  loadState,
} from './tovyr-providers.js'
import { isLocalProviderId } from './tovyr-provider-local.js'
import { createApplicationManager } from './tovyr-apps/operations.js'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 11434
const GATEWAY_HEALTH_TIMEOUT_MS = 1_500
const CONFIG_ONLY_DESKTOP_APPS = new Set(['claude-desktop'])
const CHATGPT_DESKTOP_APPS = new Set(['chatgpt', 'chatgpt-desktop'])
const MANAGED_GATEWAY_FILE = 'desktop-codex-gateway.json'

export function parseAppInvocation(argv) {
  const app = argv[0] || 'codex'
  let provider
  let model
  const passthrough = []
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--provider' || arg === '-P' || arg === '--model' || arg === '-M') {
      const value = argv[i + 1]
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for ${arg}.`)
      }
      if (arg === '--provider' || arg === '-P') provider = value
      else model = value
      i += 1
    } else {
      passthrough.push(arg)
    }
  }
  return { app, provider, model, passthrough }
}

function readModelCache() {
  try {
    const file = join(getTovyrHome(), '.tovyr', 'model-cache.json')
    if (!existsSync(file)) return {}
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function connectedSources(state = loadState()) {
  const cache = readModelCache()
  return listActivatedProviderIds(state)
    .filter(providerId => !isLocalProviderId(providerId) || Boolean(state.models?.[providerId]))
    .flatMap(providerId => {
      const provider = getProvider(providerId, state)
      if (!provider) return []
      const cached = cache[providerId]?.ids
      const ids = Array.isArray(cached) && cached.length
        ? cached
        : (provider.models || []).map(model => model.id)
      const unique = [...new Set(ids.filter(id => typeof id === 'string' && id))]
      if (!unique.length) {
        const fallback = getActiveModelId(providerId, state)
        if (fallback) unique.push(fallback)
      }
      return [{
        providerId,
        providerLabel: provider.label || providerId,
        models: unique.map(id => ({
          id,
          label: provider.models?.find(model => model.id === id)?.label || id,
        })),
      }]
    })
}

export function buildAppModelChoices(sources) {
  const seen = new Set()
  const choices = []
  for (const source of sources) {
    for (const model of source.models || []) {
      const id = source.providerId + '::' + model.id
      if (seen.has(id)) continue
      seen.add(id)
      choices.push({
        id,
        providerId: source.providerId,
        modelId: model.id,
        label: model.label || model.id,
        providerLabel: source.providerLabel,
      })
    }
  }
  return choices
}

export function findActiveAppModelChoice(choices, providerId, modelId) {
  return choices.find(
    choice => choice.providerId === providerId && choice.modelId === modelId,
  ) || null
}

export function buildCodexLaunchArgs(providerId, modelId, passthrough = []) {
  // Codex can run a user-configured `notify` command after every turn. That
  // command commonly emits a Windows notification/error sound, which makes
  // Tovyr responses appear to fail even when the request succeeded. Tovyr's
  // launcher owns the app session, so disable only Codex's per-session hook;
  // this does not modify the user's Codex config or affect direct `codex`
  // invocations.
  return [
    '--oss',
    '--local-provider',
    'tovyr',
    '-m',
    providerId + '::' + modelId,
    '-c',
    'notify=[]',
    // These optional MCPs are commonly present in Codex's user config but
    // unavailable or unauthenticated. Disable them for this Tovyr-owned
    // session so failed handshakes do not look like model/gateway failures.
    // This is a per-process override; the user's Codex config is never edited.
    '-c',
    'mcp_servers.hf-mcp-server.enabled=false',
    '-c',
    'mcp_servers.mobbin.enabled=false',
    '-c',
    'mcp_servers.Roblox_Studio.enabled=false',
    ...passthrough,
  ]
}

/**
 * `codex app` opens the Codex view in the current ChatGPT desktop app. Its
 * config override is transient: it selects this Tovyr model for the launch
 * without overwriting the user's normal Codex model preference.
 */
export function buildChatgptDesktopLaunchArgs(qualifiedModel, workspace = process.cwd()) {
  return [
    'app',
    '-c',
    'model=' + JSON.stringify(qualifiedModel),
    // Match the quiet Codex CLI bridge. These are launch-only config
    // overrides, so desktop app settings and optional MCPs remain untouched
    // when Tovyr is not the thing opening the session.
    '-c',
    'notify=[]',
    '-c',
    'mcp_servers.hf-mcp-server.enabled=false',
    '-c',
    'mcp_servers.mobbin.enabled=false',
    '-c',
    'mcp_servers.Roblox_Studio.enabled=false',
    workspace,
  ]
}

export function desktopComponentMissing(output) {
  return /Codex Desktop not found/i.test(String(output || ''))
}

export function parseWindowsAppxExecutable(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(value => value.trim())
    .find(value => /\.exe$/i.test(value)) || null
}

export function buildClaudeLaunchEnv(token, qualifiedModel) {
  return {
    ANTHROPIC_BASE_URL: 'http://' + DEFAULT_HOST + ':' + DEFAULT_PORT,
    ANTHROPIC_API_KEY: token,
    ANTHROPIC_MODEL: qualifiedModel,
  }
}

/**
 * Remove credentials that could make Claude CLI select an upstream provider
 * instead of Tovyr's gateway. Keep unrelated environment variables intact.
 */
export function sanitizeClaudeParentEnv(parentEnv = process.env) {
  const sanitized = { ...parentEnv }
  for (const key of [
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_MODEL',
  ]) {
    delete sanitized[key]
  }
  return sanitized
}

export function isDirectWindowsExecutable(command) {
  return /\.(?:exe|com)$/i.test(String(command || ''))
}

export function resolveLaunchShell(command) {
  return process.platform === 'win32' && !isDirectWindowsExecutable(command)
}

function resolveLaunchCommand(command) {
  if (process.platform !== 'win32' || isDirectWindowsExecutable(command)) return command
  try {
    const matches = execFileSync('where.exe', [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean)
    const executable = matches.find(isDirectWindowsExecutable)
    if (executable) return executable
  } catch {
    // Let the shell resolve commands that are not installed as direct executables.
  }
  return command
}

function resolveWindowsChatgptDesktopExecutable() {
  if (process.platform !== 'win32') return null
  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$package = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($package) { $candidate = Join-Path $package.InstallLocation 'app\\ChatGPT.exe'; if (Test-Path -LiteralPath $candidate) { [Console]::Write($candidate) } }",
    ], { encoding: 'utf8', windowsHide: true })
    return parseWindowsAppxExecutable(output)
  } catch {
    return null
  }
}

export function printAppHelp() {
  console.log([
    'Usage: tovyr <app> [options] [app arguments]',
    '',
    'Apps:',
    '  codex                    Choose a model and launch Codex CLI',
    '  claude                   Choose a model and launch Claude Code/CLI',
    '  chatgpt                  Open installed ChatGPT Desktop for Tovyr models',
    '  launch <app>             Launch or show an app connection recipe',
    '  apps list                List every supported app and readiness state',
    '  apps status [app]        Check app discovery without launching',
    '  apps configure <app>     Show a safe endpoint/model recipe',
    '  apps doctor [app]        Print actionable app diagnostics',
    '  apps disconnect <app>    Remove Tovyr-managed app metadata',
    '  apps restore <app>       Restore the last recorded app backup',
    '  apps stop chatgpt       Stop the gateway started by `tovyr chatgpt`',
    '',
    'Options:',
    '  --provider <id>          Select a connected Tovyr provider',
    '  --model <id>             Select a model (qualified provider::model also works)',
    '',
    'Use `tovyr codex` for the quiet Tovyr bridge session; running `codex`',
    'directly uses Codex\'s own MCP, skills, and notification settings.',
    '',
    'Desktop note: `tovyr chatgpt` opens ChatGPT Desktop\'s Codex view. The',
    'separate Chat and Work views use OpenAI-hosted models and cannot be',
    'redirected to a custom API endpoint.',
  ].join('\n'))
}

function choose(choices) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('No model selected. Pass --provider <id> and --model <id> in non-interactive shells.')
  }
  return new Promise(resolve => {
    console.log('\nChoose a connected Tovyr model:\n')
    choices.forEach((choice, index) => {
      console.log('  ' + (index + 1) + '. ' + choice.providerLabel + ' · ' + choice.label + '  (' + choice.id + ')')
    })
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question('\nModel number: ', answer => {
      rl.close()
      const index = Number.parseInt(answer.trim(), 10) - 1
      resolve(Number.isInteger(index) && choices[index] ? choices[index] : null)
    })
  })
}

async function resolveChoice(providerId, modelId) {
  const choices = buildAppModelChoices(connectedSources())
  if (!choices.length) {
    throw new Error('No connected Tovyr providers/models. Run "tovyr provider list" and "tovyr auth login --provider <id> --key <key>".')
  }
  const qualified = modelId?.includes('::')
    ? modelId
    : providerId && modelId
      ? providerId + '::' + modelId
      : null
  if (qualified) {
    const found = choices.find(choice => choice.id === qualified)
    if (found) return found
    throw new Error('Model "' + modelId + '" is not available on connected provider "' + providerId + '". Run "tovyr models ' + providerId + '".')
  }
  const activeProvider = getActiveProviderId()
  const activeModel = getActiveModelId(activeProvider)
  const active = findActiveAppModelChoice(choices, activeProvider, activeModel)
  // Piped/CI launches cannot answer the picker. The active Tovyr model is a
  // deterministic default, so commands such as `tovyr codex` and
  // `tovyr apps configure claude-desktop` still work from scripts.
  if (active && (!process.stdin.isTTY || !process.stdout.isTTY)) return active
  return (await choose(choices)) || active || choices[0]
}

function gatewayUrl(path = '/v1/models') {
  return 'http://' + DEFAULT_HOST + ':' + DEFAULT_PORT + path
}

async function gatewayHealthy(token) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GATEWAY_HEALTH_TIMEOUT_MS)
  try {
    const response = await fetch(gatewayUrl(), {
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

function managedGatewayPath() {
  return join(getTovyrHome(), '.tovyr', MANAGED_GATEWAY_FILE)
}

function saveManagedGateway(pid) {
  const file = managedGatewayPath()
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, JSON.stringify({ pid, host: DEFAULT_HOST, port: DEFAULT_PORT, startedAt: new Date().toISOString() }, null, 2), { mode: 0o600 })
}

function loadManagedGateway() {
  try {
    const saved = JSON.parse(readFileSync(managedGatewayPath(), 'utf8'))
    return Number.isInteger(saved?.pid) && saved.pid > 0 ? saved : null
  } catch {
    return null
  }
}

function clearManagedGateway() {
  try {
    unlinkSync(managedGatewayPath())
  } catch {
    // Nothing to clean up.
  }
}

function managedGatewayStillMatches(record) {
  if (process.platform !== 'win32') return true
  try {
    const commandLine = execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${record.pid}').CommandLine`,
    ], { encoding: 'utf8', windowsHide: true }).trim()
    return /entrypoints[\\/]cli\.tsx/i.test(commandLine) && /\bserve\b/i.test(commandLine)
  } catch {
    return false
  }
}

function stopManagedGateway() {
  const record = loadManagedGateway()
  if (!record) {
    console.log('No ChatGPT Desktop gateway was started by Tovyr.')
    return
  }
  if (!managedGatewayStillMatches(record)) {
    clearManagedGateway()
    console.log('The managed ChatGPT Desktop gateway is no longer running.')
    return
  }
  try {
    process.kill(record.pid)
    clearManagedGateway()
    console.log('Stopped the Tovyr gateway used by ChatGPT Desktop.')
  } catch (error) {
    throw new Error('Could not stop the managed gateway: ' + (error instanceof Error ? error.message : String(error)))
  }
}

async function startGateway({ persistent = false } = {}) {
  const token = process.env.TOVYR_GATEWAY_TOKEN?.trim() || 'tovyr_' + randomBytes(24).toString('base64url')
  if (await gatewayHealthy(token)) return { token, child: null }
  const bun = resolveBunExecutable()
  const root = process.env.TOVYR_PACKAGE_ROOT || process.cwd()
  const child = spawn(bun, ['run', 'src/entrypoints/cli.tsx', 'serve', '--host', DEFAULT_HOST, '--port', String(DEFAULT_PORT)], {
    cwd: root,
    env: { ...process.env, TOVYR_GATEWAY_TOKEN: token, TOVYR_GATEWAY_HOST: DEFAULT_HOST, TOVYR_GATEWAY_PORT: String(DEFAULT_PORT) },
    stdio: 'ignore',
    windowsHide: true,
    detached: persistent,
  })
  let startupError = null
  child.once('error', error => {
    startupError = error
  })
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (await gatewayHealthy(token)) return { token, child }
    if (startupError) {
      throw new Error('Tovyr gateway failed to start: ' + startupError.message)
    }
    if (child.exitCode !== null) {
      throw new Error(
        'Tovyr gateway exited before becoming ready (code ' +
          String(child.exitCode) + '). Run "tovyr serve" to inspect startup output.',
      )
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  child.kill()
  throw new Error('Tovyr gateway did not become ready. Run "tovyr serve" to inspect startup output.')
}

async function startTemporaryGateway() {
  return startGateway()
}

async function startPersistentGateway() {
  const gateway = await startGateway({ persistent: true })
  if (gateway.child) {
    saveManagedGateway(gateway.child.pid)
    gateway.child.unref()
  }
  return gateway
}

function run(command, args, env, cleanup) {
  const resolvedCommand = resolveLaunchCommand(command)
  const child = spawn(resolvedCommand, args, {
    cwd: process.env.TOVYR_INVOKE_CWD || process.cwd(),
    stdio: 'inherit',
    env,
    shell: resolveLaunchShell(resolvedCommand),
  })
  child.on('exit', (code, signal) => {
    cleanup?.()
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 0)
  })
  child.on('error', error => {
    cleanup?.()
    console.error('Could not start ' + command + ': ' + error.message)
    process.exit(1)
  })
}

function cleanupPersistentGateway(gateway) {
  if (!gateway.child) return
  gateway.child.kill()
  clearManagedGateway()
}

function spawnApplicationClient(appId, args, context) {
  const cwd = process.env.TOVYR_INVOKE_CWD || process.cwd()
  if (appId === 'chatgpt') {
    const executable = context.executable || resolveWindowsChatgptDesktopExecutable()
    if (!executable) throw new Error('Installed ChatGPT Desktop AppX executable was not found.')
    return new Promise((resolve, reject) => {
      const child = spawn(executable, [], {
        cwd,
        stdio: 'ignore',
        env: context.env,
        detached: true,
        windowsHide: false,
      })
      child.once('error', reject)
      child.unref()
      resolve()
    })
  }
  const command = appId === 'claude-code' ? 'claude' : 'codex'
  const resolvedCommand = resolveLaunchCommand(command)
  return new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, args, {
      cwd,
      stdio: 'inherit',
      env: context.env,
      shell: resolveLaunchShell(resolvedCommand),
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`${command} exited with signal ${signal}.`))
      else if (code && code !== 0) reject(new Error(`${command} exited with code ${code}.`))
      else resolve()
    })
  })
}

function createCliApplicationManager() {
  return createApplicationManager({
    connectedModelChoices: () => buildAppModelChoices(connectedSources()),
    startGateway: options => options.persistent ? startPersistentGateway() : startTemporaryGateway(),
    stopGateway: async gateway => cleanupPersistentGateway(gateway),
    spawnClient: spawnApplicationClient,
    buildClientArgs: (adapter, qualifiedModel, passthrough) => {
      if (adapter.id === 'codex') {
        const separator = qualifiedModel.indexOf('::')
        const providerId = separator > 0 ? qualifiedModel.slice(0, separator) : 'tovyr'
        const modelId = separator > 0 ? qualifiedModel.slice(separator + 2) : qualifiedModel
        return buildCodexLaunchArgs(providerId, modelId, passthrough)
      }
      return [...passthrough]
    },
    buildClientEnv: (adapter, gateway, _baseEnv, qualifiedModel) => {
      if (adapter.id === 'claude-code') {
        return {
          ...sanitizeClaudeParentEnv(process.env),
          ...buildClaudeLaunchEnv(gateway.token, qualifiedModel || ''),
        }
      }
      return { ...process.env, TOVYR_GATEWAY_TOKEN: gateway.token }
    },
  })
}

function writeManagerResult(result, io) {
  const serialized = JSON.stringify(result, null, 2)
  if (io?.write) io.write(serialized + '\n')
  else console.log(serialized)
}

async function managerSelection(parsed, options) {
  if (!parsed.provider && !parsed.model) return null
  const resolver = options?.resolveChoice || resolveChoice
  return resolver(parsed.provider, parsed.model)
}

async function dispatchManagedCommand(parsed, options = {}) {
  const manager = options.manager || createCliApplicationManager()
  const io = options.io
  const command = parsed.app.toLowerCase()
  let subcommand = null
  let target = null
  if (command === 'launch') {
    target = parsed.passthrough.shift()?.toLowerCase() || 'codex'
    subcommand = 'launch'
  } else if (command === 'apps') {
    subcommand = parsed.passthrough.shift()?.toLowerCase() || 'list'
    if (subcommand === 'start') subcommand = 'launch'
    if (subcommand !== 'list' && subcommand !== 'status' && subcommand !== 'doctor') {
      target = parsed.passthrough.shift()?.toLowerCase() || 'chatgpt'
    } else if (parsed.passthrough[0]) {
      target = parsed.passthrough.shift()?.toLowerCase()
    }
  } else {
    return false
  }

  if (subcommand === 'stop') {
    if (target && !CHATGPT_DESKTOP_APPS.has(target)) throw new Error('Only the ChatGPT Desktop gateway can be stopped here. Run: tovyr apps stop chatgpt')
    stopManagedGateway()
    return true
  }
  if (subcommand === 'list') {
    const apps = await manager.list()
    const models = typeof manager.models === 'function' ? await manager.models() : null
    writeManagerResult(models ? { apps, models } : apps, io)
    return true
  }
  if (subcommand === 'status') {
    writeManagerResult(target ? await manager.status(target) : await manager.list(), io)
    return true
  }
  if (subcommand === 'doctor') {
    writeManagerResult(target ? await manager.doctor(target) : await Promise.all((await manager.list()).map(item => manager.doctor(item.id))), io)
    return true
  }
  if (!target) throw new Error('Usage: tovyr apps <configure|launch|disconnect|restore> <app>')
  const selection = await managerSelection(parsed, options)
  let result
  if (subcommand === 'configure') result = await manager.configure(target, selection)
  else if (subcommand === 'launch') result = await manager.launch(target, selection, parsed.passthrough)
  else if (subcommand === 'disconnect') result = await manager.disconnect(target)
  else if (subcommand === 'restore') result = await manager.restore(target)
  else throw new Error('Usage: tovyr apps [list|status|configure|launch|disconnect|restore|doctor]')
  writeManagerResult(result, io)
  return true
}

/**
 * The official `codex app` command opens the installer and exits successfully
 * when the desktop component is absent. Capture that small status message so
 * a one-shot install attempt does not leave a hidden gateway process behind.
 */
function runChatgptDesktop(args, env, gateway) {
  // New Windows ChatGPT Desktop is an AppX package named OpenAI.Codex. Older
  // Codex CLIs do not recognize that installation and launch an unnecessary
  // installer, so open the registered package executable directly.
  const appxExecutable = resolveWindowsChatgptDesktopExecutable()
  if (appxExecutable) {
    const child = spawn(appxExecutable, [], {
      cwd: process.env.TOVYR_INVOKE_CWD || process.cwd(),
      stdio: 'ignore',
      env,
      detached: true,
      windowsHide: false,
    })
    child.once('error', error => {
      cleanupPersistentGateway(gateway)
      console.error('Could not open the installed ChatGPT Desktop app: ' + error.message)
    })
    child.unref()
    console.log('Opened the installed ChatGPT Desktop app. In its Codex composer, use /model to select a Tovyr model.')
    return
  }
  const command = 'codex'
  const resolvedCommand = resolveLaunchCommand(command)
  const child = spawn(resolvedCommand, args, {
    cwd: process.env.TOVYR_INVOKE_CWD || process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    shell: resolveLaunchShell(resolvedCommand),
  })
  let output = ''
  const forward = stream => {
    stream?.on('data', chunk => {
      const text = String(chunk)
      output += text
      process.stdout.write(text)
    })
  }
  forward(child.stdout)
  forward(child.stderr)
  child.on('exit', (code, signal) => {
    if (desktopComponentMissing(output)) {
      cleanupPersistentGateway(gateway)
      console.error('Install the Codex desktop component, then rerun: tovyr chatgpt')
    }
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 0)
  })
  child.on('error', error => {
    cleanupPersistentGateway(gateway)
    console.error('Could not start ' + command + ': ' + error.message)
    process.exit(1)
  })
}

function printDesktopConfig(app, choice) {
  const qualified = choice.id
  console.log('\nTovyr model selected: ' + choice.providerLabel + ' · ' + choice.label)
  console.log('Model id: ' + qualified)
  console.log('OpenAI-compatible endpoint: http://' + DEFAULT_HOST + ':' + DEFAULT_PORT + '/v1')
  console.log('Anthropic Messages endpoint: http://' + DEFAULT_HOST + ':' + DEFAULT_PORT)
  if (app === 'claude-desktop') {
    console.log('\nClaude Desktop does not support replacing its hosted model endpoint. Use Claude Code/CLI with "tovyr claude", or connect Tovyr tools through MCP: "tovyr mcp serve".')
  } else {
    console.log('\nChatGPT Desktop works through its Codex view. Run "tovyr chatgpt" to start Tovyr\'s local gateway, select this model for that desktop launch, and open the Codex view.')
    console.log('The separate Chat and Work views cannot be redirected to a custom model API.')
  }
  console.log('\nThe selected model is not written to desktop credentials or config files.')
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const parsed = parseAppInvocation(argv)
  if (process.env.TOVYR_APP_LAUNCH === '1' && parsed.app.toLowerCase() !== 'apps' && parsed.app.toLowerCase() !== 'launch') {
    parsed.passthrough.unshift(parsed.app)
    parsed.app = 'launch'
  }
  if (parsed.passthrough.includes('--help') || parsed.passthrough.includes('-h')) {
    printAppHelp()
    return
  }
  if (parsed.app.toLowerCase() === 'apps' || parsed.app.toLowerCase() === 'launch') {
    if (await dispatchManagedCommand(parsed, options)) return
  }
  let app = parsed.app.toLowerCase()
  let configurationOnly = false
  if (app === 'apps') {
    const subcommand = parsed.passthrough.shift()?.toLowerCase() || 'list'
    if (subcommand === 'list' || subcommand === 'status') app = 'list'
    else if (subcommand === 'configure') {
      app = parsed.passthrough.shift()?.toLowerCase() || 'claude-desktop'
      configurationOnly = true
    }
    else if (subcommand === 'start') app = parsed.passthrough.shift()?.toLowerCase() || 'chatgpt'
    else if (subcommand === 'stop') {
      const target = parsed.passthrough.shift()?.toLowerCase() || 'chatgpt'
      if (!CHATGPT_DESKTOP_APPS.has(target)) throw new Error('Only the ChatGPT Desktop gateway can be stopped here. Run: tovyr apps stop chatgpt')
      stopManagedGateway()
      return
    } else throw new Error('Usage: tovyr apps [list|status|configure <app>|start chatgpt|stop chatgpt]')
  }
  if (app === 'list' || app === 'status') {
    const choices = buildAppModelChoices(connectedSources())
    console.log(choices.length ? choices.map(choice => choice.id + '  ' + choice.providerLabel + ' · ' + choice.label).join('\n') : 'No connected Tovyr models.')
    return
  }
  const choice = await resolveChoice(parsed.provider, parsed.model)
  if (configurationOnly) {
    if (app !== 'claude-desktop' && !CHATGPT_DESKTOP_APPS.has(app)) {
      throw new Error('Configuration details are available for claude-desktop or chatgpt-desktop.')
    }
    printDesktopConfig(app, choice)
    return
  }
  if (CONFIG_ONLY_DESKTOP_APPS.has(app)) {
    printDesktopConfig(app, choice)
    return
  }
  if (CHATGPT_DESKTOP_APPS.has(app)) {
    const gateway = await startPersistentGateway()
    const workspace = process.env.TOVYR_INVOKE_CWD || process.cwd()
    console.log('\nTovyr gateway is ready on http://' + DEFAULT_HOST + ':' + DEFAULT_PORT + '/v1')
    console.log('Prepared Tovyr model: ' + choice.providerLabel + ' · ' + choice.label + '.')
    console.log('In ChatGPT Desktop\'s Codex composer, use /model to select it. Chat and Work stay on their built-in OpenAI models.')
    console.log('Stop this local gateway with: tovyr apps stop chatgpt')
    runChatgptDesktop(
      buildChatgptDesktopLaunchArgs(choice.id, workspace),
      { ...process.env, TOVYR_GATEWAY_TOKEN: gateway.token },
      gateway,
    )
    return
  }
  const gateway = await startTemporaryGateway()
  if (app === 'codex') {
    const env = { ...process.env, TOVYR_GATEWAY_TOKEN: gateway.token }
    run('codex', buildCodexLaunchArgs(choice.providerId, choice.modelId, parsed.passthrough), env, () => gateway.child?.kill())
    return
  }
  if (app === 'claude' || app === 'claude-code') {
    const env = {
      ...sanitizeClaudeParentEnv(process.env),
      ...buildClaudeLaunchEnv(gateway.token, choice.id),
    }
    run('claude', parsed.passthrough, env, () => gateway.child?.kill())
    return
  }
  throw new Error('Unsupported app "' + parsed.app + '". Supported: codex, claude, claude-desktop, chatgpt, chatgpt-desktop, list.')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error('Tovyr app launcher: ' + (error instanceof Error ? error.message : String(error)))
    process.exit(2)
  })
}
