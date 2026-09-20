/**
 * Clear legacy web OAuth so Graft uses only the FreeModel API key from config.
 * Usage: node scripts/clear-graft-oauth.js
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const home = process.env.USERPROFILE || process.env.HOME || ''
const configPath = join(home, '.graft.json')
const credPath = join(home, '.graft', '.credentials.json')

let changed = false

if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  if (config.oauthAccount !== undefined) {
    delete config.oauthAccount
    changed = true
  }
  if (changed) {
    writeFileSync(configPath, JSON.stringify(config, null, 2))
  }
}

if (existsSync(credPath)) {
  const cred = JSON.parse(readFileSync(credPath, 'utf8'))
  if (cred.claudeAiOauth) {
    delete cred.claudeAiOauth
    changed = true
    if (Object.keys(cred).length === 0) {
      unlinkSync(credPath)
    } else {
      writeFileSync(credPath, JSON.stringify(cred, null, 2))
    }
  }
}

if (changed) {
  console.log('Cleared legacy web OAuth session (Graft uses FreeModel API key only).')
} else {
  console.log('No legacy web OAuth session found.')
}
