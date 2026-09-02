#!/usr/bin/env node
/**
 * Remove settings written into Claude Code by older Tovyr launchers.
 * Creates timestamped backups first and never touches Claude credentials.
 *
 * Backups live under ~/.tovyr — writing them into ~/.claude was itself a
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
const tovyrConfigPath = path.join(home, '.tovyr.json')
const tovyrSettingsPath = path.join(home, '.tovyr', 'settings.json')
const backupDir = path.join(
  home,
  '.tovyr',
  `isolation-backup-${Date.now()}`,
)

function readJson(file) {
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.tovyr-repair-${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  renameSync(temp, file)
}

const claudeConfig = readJson(claudeConfigPath)
const claudeSettings = readJson(claudeSettingsPath)
const tovyrConfig = readJson(tovyrConfigPath)
const tovyrSettings = readJson(tovyrSettingsPath)

const PROVIDER_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'TOVYR_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'TOVYR_CODE_DISABLE_THINKING',
  'DISABLE_INTERLEAVED_THINKING',
  'ENABLE_TOOL_SEARCH',
]

/** Provider env Tovyr pushed into Claude Code's settings.json. */
const settingsCarriesTovyrEnv = Boolean(
  claudeSettings?.env &&
    (claudeSettings.env.ANTHROPIC_BASE_URL ===
      tovyrSettings?.env?.ANTHROPIC_BASE_URL ||
      claudeSettings.env.ANTHROPIC_MODEL ===
        tovyrSettings?.env?.ANTHROPIC_MODEL),
)

const hasTovyrMarkers = Boolean(
  claudeConfig?.tovyrProvider ||
    claudeConfig?.companion?.name === 'Tovyr Buddy' ||
    settingsCarriesTovyrEnv,
)

if (!hasTovyrMarkers) {
  console.log('Claude Code config is already isolated from Tovyr.')
  process.exit(0)
}

mkdirSync(backupDir, { recursive: true })
for (const file of [claudeConfigPath, claudeSettingsPath]) {
  if (existsSync(file)) {
    copyFileSync(file, path.join(backupDir, path.basename(file)))
  }
}

if (claudeConfig) {
  delete claudeConfig.tovyrProvider
  if (claudeConfig.companion?.name === 'Tovyr Buddy') {
    delete claudeConfig.companion
    delete claudeConfig.companionMuted
  }
  const tovyrKeyPath = path.join(home, '.tovyr', 'api-key')
  const tovyrApiKey = existsSync(tovyrKeyPath)
    ? readFileSync(tovyrKeyPath, 'utf8').trim()
    : tovyrConfig?.primaryApiKey
  if (
    claudeConfig.primaryApiKey &&
    claudeConfig.primaryApiKey === tovyrApiKey
  ) {
    delete claudeConfig.primaryApiKey
  }
  writeJsonAtomic(claudeConfigPath, claudeConfig)
}

if (claudeSettings?.env && settingsCarriesTovyrEnv) {
  for (const key of PROVIDER_ENV_KEYS) delete claudeSettings.env[key]
  if (Object.keys(claudeSettings.env).length === 0) {
    delete claudeSettings.env
  }
  writeJsonAtomic(claudeSettingsPath, claudeSettings)
}

console.log(`Claude Code isolation repaired. Backup: ${backupDir}`)
if (settingsCarriesTovyrEnv) {
  console.log(
    'Note: older Tovyr builds also stripped python3/bash hooks from ' +
      'Claude Code settings without backing them up first. Those cannot be ' +
      'restored automatically — check your hooks if you used any.',
  )
}
