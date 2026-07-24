#!/usr/bin/env node
/**
 * Publish the thin blinkcode launcher to npm (package.npm.json manifest).
 * Restores package.json after publish. Does not publish devDependencies.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { getBlinkPackageRoot } from './blink-package-root.js'

const root = getBlinkPackageRoot()
const devPkgPath = join(root, 'package.json')
const npmPkgPath = join(root, 'package.npm.json')
const readmeNpm = join(root, 'README.npm.md')
const readmeMain = join(root, 'README.md')
const backupPkg = join(root, '.package.dev.json.bak')
const backupReadme = join(root, '.README.dev.md.bak')

if (!existsSync(npmPkgPath)) {
  console.error('Missing package.npm.json')
  process.exit(1)
}

const npmPkg = JSON.parse(readFileSync(npmPkgPath, 'utf8'))

// Keep npm manifest version aligned with BLINK_VERSION (constants/blink.js).
try {
  const blinkConstants = join(root, 'constants', 'blink.js')
  const src = readFileSync(blinkConstants, 'utf8')
  const match = src.match(/export const BLINK_VERSION = '([^']+)'/)
  if (match?.[1]) {
    npmPkg.version = match[1]
  }
} catch {
  // Fall back to package.npm.json version.
}

console.log(`Publishing ${npmPkg.name}@${npmPkg.version} to npm...`)

function resolveNpmExecutable() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function spawnNpm(args, options = {}) {
  const npm = resolveNpmExecutable()
  // Windows .cmd launchers require shell:true (Node EINVAL otherwise).
  const useShell = process.platform === 'win32'
  return spawnSync(npm, args, { shell: useShell, ...options })
}

function runBlinkTests() {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'blink-test.js')], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  })
  if (r.status !== 0) {
    console.error('Pre-publish tests failed (node scripts/blink-test.js)')
    throw new Error(`Pre-publish tests failed (exit ${r.status ?? 1})`)
  }
}

function npmWhoami() {
  const r = spawnNpm(['whoami'], { encoding: 'utf8' })
  if (r.status !== 0) return null
  return r.stdout.trim() || null
}

const dryRun = process.argv.includes('--dry-run')
if (!dryRun) {
  // Project .npmrc with ${NPM_TOKEN} overrides ~/.npmrc and breaks `npm login`.
  const localNpmrc = join(root, '.npmrc')
  if (existsSync(localNpmrc)) {
    const body = readFileSync(localNpmrc, 'utf8')
    if (body.includes('${NPM_TOKEN}') || body.includes('_authToken')) {
      console.warn(
        'Warning: .npmrc in this folder overrides npm login. Remove it or use npm run publish:npm from a clean env.',
      )
    }
  }

  const user = npmWhoami()
  if (!user) {
    console.error(
      [
        'npm publish failed: you are not logged in.',
        '',
        '  npm login',
        '',
        `Then publish again: npm run publish:npm`,
        '',
        `Package "${npmPkg.name}" on npm is owned by blink2 — use that account`,
        '(or an npm account added as a maintainer on https://www.npmjs.com/package/blinkcode).',
      ].join('\n'),
    )
    process.exit(1)
  }
  console.log(`Logged in as: ${user}`)
}

copyFileSync(devPkgPath, backupPkg)
if (existsSync(readmeMain)) copyFileSync(readmeMain, backupReadme)

let result = { status: 0 }
try {
  // npm uses README.md at package root
  if (existsSync(readmeNpm)) {
    copyFileSync(readmeNpm, readmeMain)
  }

  writeFileSync(devPkgPath, JSON.stringify(npmPkg, null, 2) + '\n')

  if (!dryRun) {
    console.log('Running pre-publish tests...')
    runBlinkTests()
  }

  const args = dryRun ? ['pack', '--dry-run'] : ['publish', '--access', 'public']
  result = spawnNpm(args, { cwd: root, stdio: 'inherit' })
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  if (existsSync(backupPkg)) {
    copyFileSync(backupPkg, devPkgPath)
  }
  if (existsSync(backupReadme)) {
    copyFileSync(backupReadme, readmeMain)
  }
}

if (result.status !== 0) {
  console.error(dryRun ? 'npm pack dry-run failed' : 'npm publish failed')
  process.exit(result.status ?? 1)
}

if (dryRun) {
  console.log(`Dry run OK — would publish ${npmPkg.name}@${npmPkg.version}`)
} else {
  console.log(`Published ${npmPkg.name}@${npmPkg.version}`)
  console.log(`https://www.npmjs.com/package/${npmPkg.name}`)
}
