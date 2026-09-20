import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { getAppAdapter, listAppAdapters } from './catalog.js'

export const CHATGPT_APPX_QUERY = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  "$package = Get-AppxPackage -Name 'OpenAI.Codex' | Sort-Object Version -Descending | Select-Object -First 1",
  "if ($null -ne $package) {",
  "  $candidate = Join-Path $package.InstallLocation 'app\\ChatGPT.exe'",
  "  if (Test-Path -LiteralPath $candidate) { [Console]::WriteLine($candidate) }",
  '}',
].join('\n')

/** Return the installed ChatGPT AppX executable, never an installer path. */
export function parseWindowsAppxExecutable(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => /(?:^|[\\/])app[\\/]ChatGPT\.exe$/i.test(line)) || null
}

function firstCommandPath(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) || null
}

function productionRuntime() {
  const platform = process.platform
  return {
    platform,
    exists: existsSync,
    findCommand(command) {
      if (!command) return null
      try {
        const lookup = platform === 'win32' ? 'where.exe' : 'which'
        return firstCommandPath(execFileSync(lookup, [command], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          windowsHide: true,
        }))
      } catch {
        return null
      }
    },
    runPowerShell(script) {
      if (platform !== 'win32') return ''
      try {
        return execFileSync('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          script,
        ], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          windowsHide: true,
        })
      } catch {
        return ''
      }
    },
  }
}

function numericVersion(value) {
  const match = String(value || '').match(/\d+(?:\.\d+){0,3}/)
  return match ? match[0].split('.').map(part => Number(part)) : null
}

function versionIsBelow(actual, minimum) {
  const left = numericVersion(actual)
  const right = numericVersion(minimum)
  if (!left || !right) return false
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] || 0
    const b = right[index] || 0
    if (a !== b) return a < b
  }
  return false
}

function statusFor(adapter, executable, runtime) {
  if (!executable) {
    return {
      ...adapter,
      executable: null,
      readiness: adapter.integrationKind === 'tool-only' ? 'tool-only' : adapter.readiness === 'ready' ? 'missing' : adapter.readiness,
      reason: adapter.recovery || null,
    }
  }
  const actualVersion = runtime.version || (typeof runtime.getVersion === 'function'
    ? runtime.getVersion(executable)
    : null)
  if (adapter.minimumVersion && actualVersion && versionIsBelow(actualVersion, adapter.minimumVersion)) {
    return {
      ...adapter,
      executable,
      readiness: 'unsupported-version',
      reason: `${adapter.label} ${actualVersion} is below the required ${adapter.minimumVersion}.`,
    }
  }
  return { ...adapter, executable, readiness: 'ready', reason: null }
}

export function discoverApp(adapter, runtime = productionRuntime()) {
  if (!adapter) return null
  if (adapter.integrationKind === 'tool-only' || adapter.integrationKind === 'manual-setup') {
    return statusFor(adapter, null, runtime)
  }

  let executable = null
  if (adapter.id === 'chatgpt' && runtime.platform === 'win32') {
    const output = typeof runtime.runPowerShell === 'function'
      ? runtime.runPowerShell(CHATGPT_APPX_QUERY)
      : ''
    const candidate = parseWindowsAppxExecutable(output)
    if (candidate && (!runtime.exists || runtime.exists(candidate))) executable = candidate
  }
  if (!executable && typeof runtime.findCommand === 'function') {
    executable = runtime.findCommand(adapter.command)
  }
  return statusFor(adapter, executable, runtime)
}

export function listAppStatuses(runtime = productionRuntime()) {
  return listAppAdapters().map(adapter => discoverApp(adapter, runtime))
}

export function resolveProductionRuntime() {
  return productionRuntime()
}

// Keep this helper available to operations without exposing implementation details.
export function getDiscoveredAdapter(id, runtime = productionRuntime()) {
  return discoverApp(getAppAdapter(id), runtime)
}
