#!/usr/bin/env node
/**
 * Remove settings written into Claude Code by older Graft launchers.
 * Creates timestamped backups first and never touches Claude credentials.
 *
 * Backups live under ~/.graft — writing them into ~/.claude was itself a
 * (smaller) version of the problem this script exists to undo.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = os.homedir()
const claudeConfigPath = path.join(home, '.claude.json')
const claudeSettingsPath = path.join(home, '.claude', 'settings.json')
const graftConfigPath = path.join(home, '.graft.json')
const graftSettingsPath = path.join(home, '.graft', 'settings.json')
const backupDir = path.join(
  home,
  '.graft',
  `isolation-backup-${Date.now()}`,
)

function readJson(file) {
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.graft-repair-${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  renameSync(temp, file)
}

const claudeConfig = readJson(claudeConfigPath)
const claudeSettings = readJson(claudeSettingsPath)
const graftConfig = readJson(graftConfigPath)
const graftSettings = readJson(graftSettingsPath)

const PROVIDER_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'GRAFT_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'GRAFT_CODE_DISABLE_THINKING',
  'DISABLE_INTERLEAVED_THINKING',
  'ENABLE_TOOL_SEARCH',
]

/** Provider env Graft pushed into Claude Code's settings.json. */
const settingsCarriesGraftEnv = Boolean(
  claudeSettings?.env &&
    (claudeSettings.env.ANTHROPIC_BASE_URL ===
      graftSettings?.env?.ANTHROPIC_BASE_URL ||
      claudeSettings.env.ANTHROPIC_MODEL ===
        graftSettings?.env?.ANTHROPIC_MODEL),
)

const hasGraftMarkers = Boolean(
  claudeConfig?.graftProvider ||
    claudeConfig?.companion?.name === 'Graft Buddy' ||
    settingsCarriesGraftEnv,
)

if (!hasGraftMarkers) {
  console.log('Claude Code config is already isolated from Graft.')
  process.exit(0)
}

mkdirSync(backupDir, { recursive: true })
for (const file of [claudeConfigPath, claudeSettingsPath]) {
  if (existsSync(file)) {
    copyFileSync(file, path.join(backupDir, path.basename(file)))
  }
}

if (claudeConfig) {
  delete claudeConfig.graftProvider
  if (claudeConfig.companion?.name === 'Graft Buddy') {
    delete claudeConfig.companion
    delete claudeConfig.companionMuted
  }
  const graftKeyPath = path.join(home, '.graft', 'api-key')
  const graftApiKey = existsSync(graftKeyPath)
    ? readFileSync(graftKeyPath, 'utf8').trim()
    : graftConfig?.primaryApiKey
  if (
    claudeConfig.primaryApiKey &&
    claudeConfig.primaryApiKey === graftApiKey
  ) {
    delete claudeConfig.primaryApiKey
  }
  writeJsonAtomic(claudeConfigPath, claudeConfig)
}

if (claudeSettings?.env && settingsCarriesGraftEnv) {
  for (const key of PROVIDER_ENV_KEYS) delete claudeSettings.env[key]
  if (Object.keys(claudeSettings.env).length === 0) {
    delete claudeSettings.env
  }
  writeJsonAtomic(claudeSettingsPath, claudeSettings)
}

console.log(`Claude Code isolation repaired. Backup: ${backupDir}`)
if (settingsCarriesGraftEnv) {
  console.log(
    'Note: older Graft builds also stripped python3/bash hooks from ' +
      'Claude Code settings without backing them up first. Those cannot be ' +
      'restored automatically — check your hooks if you used any.',
  )
}
