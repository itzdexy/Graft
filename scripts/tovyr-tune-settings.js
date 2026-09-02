/**
 * Tovyr-specific ~/.tovyr/settings.json cleanup.
 * - Disables plugins with bash/python3 hooks that fail on Windows
 * - Removes duplicate ANTHROPIC_API_KEY when apiKeyHelper is used
 *
 * This used to read and OVERWRITE ~/.claude/settings.json on every single
 * launch, creating the directory if it did not exist. That is another
 * product's configuration file: it clobbered the user's Claude Code setup
 * and was the reported "installing Tovyr messes up claude code" bug.
 * Tovyr's own settings live in ~/.tovyr (see
 * getRelativeSettingsFilePathForSource in utils/settings/settings.ts), and
 * nothing outside ~/.tovyr may be written.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

/** Plugins that install Unix-only hooks (python3, bash). */
const DISABLE_ON_WINDOWS = [
  'sonarqube@claude-plugins-official',
]

function hookUsesUnixShell(entry) {
  const cmd =
    typeof entry === 'string'
      ? entry
      : entry?.command ?? entry?.cmd ?? entry?.script ?? ''
  if (!cmd) return false
  return (
    cmd.includes('python3') ||
    cmd.includes('/usr/bin/bash') ||
    cmd.includes('/bin/bash')
  )
}

function stripUnixHooks(hooks) {
  if (!hooks || typeof hooks !== 'object') return hooks

  const next = {}
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) {
      next[event] = groups
      continue
    }

    const filtered = groups
      .map((group) => {
        if (!group || typeof group !== 'object') return group
        const hooksList = Array.isArray(group.hooks) ? group.hooks : []
        const kept = hooksList.filter((h) => !hookUsesUnixShell(h))
        if (kept.length === 0) return null
        return { ...group, hooks: kept }
      })
      .filter(Boolean)

    if (filtered.length > 0) next[event] = filtered
  }
  return next
}

export function tuneTovyrSettings(settings) {
  const tuned = { ...settings }

  if (process.platform === 'win32') {
    tuned.enabledPlugins = { ...(tuned.enabledPlugins ?? {}) }
    for (const id of DISABLE_ON_WINDOWS) {
      if (tuned.enabledPlugins[id]) {
        tuned.enabledPlugins[id] = false
      }
    }
    if (tuned.hooks) {
      tuned.hooks = stripUnixHooks(tuned.hooks)
    }
  }

  if (tuned.apiKeyHelper && tuned.env?.ANTHROPIC_API_KEY) {
    const { ANTHROPIC_API_KEY: _removed, ...rest } = tuned.env
    tuned.env = rest
  }

  return tuned
}

/** Absolute path to Tovyr's own user settings file. */
export function getTovyrSettingsPath() {
  const home = process.env.USERPROFILE || process.env.HOME || ''
  return join(home, '.tovyr', 'settings.json')
}

export function applyTovyrSettingsTune() {
  const settingsPath = getTovyrSettingsPath()
  const tovyrDir = dirname(settingsPath)

  if (!existsSync(tovyrDir)) {
    mkdirSync(tovyrDir, { recursive: true })
  }

  let settings = {}
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    } catch {
      // A corrupt settings file must not stop the CLI from starting; the tune
      // below rebuilds a valid document from scratch.
      settings = {}
    }
  }

  const tuned = tuneTovyrSettings(settings)
  writeFileSync(settingsPath, `${JSON.stringify(tuned, null, 2)}
`)
  return settingsPath
}

// Self-invoke guard. This checked for 'kairo-tune-settings.js', a filename
// left over from an earlier rename, so running this script directly did
// nothing at all.
if (process.argv[1]?.endsWith('tovyr-tune-settings.js')) {
  const path = applyTovyrSettingsTune()
  console.log(`Tovyr settings tuned: ${path}`)
}
