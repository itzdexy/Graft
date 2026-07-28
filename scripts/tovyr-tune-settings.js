/**
 * Tovyr-specific ~/.claude/settings.json cleanup.
 * - Disables plugins with bash/python3 hooks that fail on Windows
 * - Removes duplicate ANTHROPIC_API_KEY when apiKeyHelper is used
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

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

export function applyTovyrSettingsTune() {
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const claudeDir = join(home, '.claude')
  const settingsPath = join(claudeDir, 'settings.json')

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true })
  }

  let settings = {}
  if (existsSync(settingsPath)) {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
  }

  const tuned = tuneTovyrSettings(settings)
  writeFileSync(settingsPath, JSON.stringify(tuned, null, 2))
  return settingsPath
}

if (process.argv[1]?.endsWith('kairo-tune-settings.js')) {
  const path = applyTovyrSettingsTune()
  console.log(`Tovyr settings tuned: ${path}`)
}
