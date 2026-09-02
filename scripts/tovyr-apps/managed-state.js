import { randomUUID } from 'node:crypto'
import {
  chmodSync as defaultChmodSync,
  mkdirSync as defaultMkdirSync,
  readFileSync as defaultReadFileSync,
  renameSync as defaultRenameSync,
  unlinkSync as defaultUnlinkSync,
  writeFileSync as defaultWriteFileSync,
} from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const SENSITIVE_KEY_PATTERN = /token|secret|api.?key/i

function validateAppId(id) {
  const value = String(id ?? '').trim().toLowerCase()
  return APP_ID_PATTERN.test(value) ? value : null
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (!value || typeof value !== 'object') return value
  const result = {}
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue
    result[key] = sanitizeValue(nested)
  }
  return result
}

function ownerOnly(path, chmodSync) {
  try { chmodSync(path, 0o600) } catch { /* ACLs on Windows may ignore POSIX mode bits. */ }
}

export function createManagedState(home, fsOverrides = {}) {
  const fs = {
    chmodSync: defaultChmodSync,
    mkdirSync: defaultMkdirSync,
    readFileSync: defaultReadFileSync,
    renameSync: defaultRenameSync,
    unlinkSync: defaultUnlinkSync,
    writeFileSync: defaultWriteFileSync,
    ...fsOverrides,
  }
  const root = join(resolve(home), '.tovyr', 'apps')
  const backupsRoot = join(root, 'backups')

  function ensureDirectory(path) {
    fs.mkdirSync(path, { recursive: true, mode: 0o700 })
  }

  function connectionPath(id) {
    const appId = validateAppId(id)
    return appId ? join(root, `${appId}.json`) : null
  }

  function backupDirectory(id) {
    const appId = validateAppId(id)
    return appId ? join(backupsRoot, appId) : null
  }

  function atomicWrite(path, content) {
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
    try {
      ensureDirectory(join(path, '..'))
      fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o600, flag: 'w' })
      ownerOnly(temporaryPath, fs.chmodSync)
      fs.renameSync(temporaryPath, path)
      ownerOnly(path, fs.chmodSync)
      return { ok: true, path }
    } catch (error) {
      try { fs.unlinkSync(temporaryPath) } catch { /* preserve the original file on failure */ }
      return { error: 'write-failed', path, message: error instanceof Error ? error.message : String(error) }
    }
  }

  function readConnection(id) {
    const appId = validateAppId(id)
    const path = connectionPath(appId)
    if (!path) return { error: 'invalid-app-id', appId: String(id ?? '') }
    let raw
    try {
      raw = fs.readFileSync(path, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      return { error: 'read-failed', appId, path, message: error instanceof Error ? error.message : String(error) }
    }
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || parsed.appId !== appId) throw new Error('invalid connection shape')
      return parsed
    } catch (error) {
      return { error: 'invalid-manifest', appId, path, message: error instanceof Error ? error.message : String(error) }
    }
  }

  function saveConnection(record) {
    const appId = validateAppId(record?.appId)
    if (!appId) return { error: 'invalid-app-id', appId: record?.appId ?? null }
    const sanitized = sanitizeValue({
      version: 1,
      ...record,
      appId,
    })
    const path = connectionPath(appId)
    const result = atomicWrite(path, JSON.stringify(sanitized, null, 2) + '\n')
    return result.ok ? sanitized : result
  }

  function removeConnection(id) {
    const appId = validateAppId(id)
    const path = connectionPath(appId)
    if (!path) return { error: 'invalid-app-id', appId: String(id ?? '') }
    try {
      fs.unlinkSync(path)
      return { removed: true, appId }
    } catch (error) {
      if (error?.code === 'ENOENT') return { removed: false, appId }
      return { error: 'remove-failed', appId, path, message: error instanceof Error ? error.message : String(error) }
    }
  }

  function recordBackup(id, sourcePath, content) {
    const appId = validateAppId(id)
    if (!appId || !isAbsolute(String(sourcePath || ''))) {
      return { error: 'invalid-backup-target', appId: appId || String(id ?? ''), path: String(sourcePath || '') }
    }
    const directory = backupDirectory(appId)
    const path = join(directory, 'latest.json')
    const backup = {
      version: 1,
      appId,
      targetPath: resolve(String(sourcePath)),
      content: Buffer.isBuffer(content) ? content.toString('utf8') : String(content ?? ''),
      createdAt: new Date().toISOString(),
    }
    const result = atomicWrite(path, JSON.stringify(backup, null, 2) + '\n')
    return result.ok ? { recorded: true, appId, path, targetPath: backup.targetPath } : result
  }

  function restoreBackup(id, writeFile = defaultWriteFileSync, expectedTargetPath = null) {
    const appId = validateAppId(id)
    const path = appId ? join(backupDirectory(appId), 'latest.json') : null
    if (!path) return { error: 'invalid-app-id', appId: String(id ?? '') }
    let backup
    try {
      backup = JSON.parse(fs.readFileSync(path, 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') return { error: 'backup-not-found', appId, path }
      return { error: 'invalid-backup', appId, path, message: error instanceof Error ? error.message : String(error) }
    }
    const rawTarget = String(backup.targetPath || '')
    const target = isAbsolute(rawTarget) ? resolve(rawTarget) : null
    if (backup.appId !== appId || !target || (expectedTargetPath && resolve(expectedTargetPath) !== target)) {
      return { error: 'backup-target-mismatch', appId, path, targetPath: backup.targetPath || null }
    }
    try {
      writeFile(target, backup.content, { encoding: 'utf8' })
      return { restored: true, path: target }
    } catch (error) {
      return { error: 'restore-failed', appId, path: target, message: error instanceof Error ? error.message : String(error) }
    }
  }

  return {
    root,
    backupsRoot,
    connectionPath,
    readConnection,
    saveConnection,
    removeConnection,
    recordBackup,
    restoreBackup,
  }
}
