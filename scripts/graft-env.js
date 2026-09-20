import { existsSync, copyFileSync, mkdirSync, constants } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** Legacy variables remain input aliases; runtime settings use GRAFT_. */
export function applyGraftEnvironment(env = process.env) {
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('TOVYR_') && value !== undefined) {
      const current = `GRAFT_${name.slice(6)}`
      if (env[current] === undefined) env[current] = value
    }
  }
  return env
}

/** Copy settings on first launch; retain legacy data and existing Graft files. */
export function migrateGraftSettings(home) {
  const old = join(home, '.tovyr')
  const current = join(home, '.graft')
  for (const name of ['providers.json', 'active.json', 'settings.json', 'api-key', '.tovyr.json']) {
    const source = join(old, name)
    const target = join(current, name === '.tovyr.json' ? '.graft.json' : name)
    if (!existsSync(source) || existsSync(target)) continue
    mkdirSync(current, { recursive: true, mode: 0o700 })
    copyFileSync(source, target, constants.COPYFILE_EXCL)
  }
  if (existsSync(join(home, '.tovyr.json')) && !existsSync(join(home, '.graft.json'))) {
    copyFileSync(join(home, '.tovyr.json'), join(home, '.graft.json'), constants.COPYFILE_EXCL)
  }
}

applyGraftEnvironment()
if (process.env.NODE_ENV !== 'test' && process.env.GRAFT_SKIP_MIGRATION !== '1' && !process.env.GRAFT_CONFIG_DIR) {
  migrateGraftSettings(process.env.GRAFT_HOME || process.env.HOME || process.env.USERPROFILE || homedir())
}
