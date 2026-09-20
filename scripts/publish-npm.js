#!/usr/bin/env node
/**
 * Publish the thin graft launcher to npm (package.npm.json manifest).
 * Restores package.json after publish. Does not publish devDependencies.
 */
import {
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { getGraftPackageRoot } from './graft-package-root.js'
import { assertReleaseReady } from './graft-release-gate.js'

const root = getGraftPackageRoot()
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

// Keep npm manifest version aligned with GRAFT_VERSION (src/constants/graft.js).
try {
  const graftConstants = join(root, 'src', 'constants', 'graft.js')
  const src = readFileSync(graftConstants, 'utf8')
  const match = src.match(/export const GRAFT_VERSION = '([^']+)'/)
  if (match?.[1]) {
    npmPkg.version = match[1]
  }
} catch {
  // Fall back to package.npm.json version.
}

console.log(`Publishing ${npmPkg.name}@${npmPkg.version} to npm...`)

function resolveNpmInvocation() {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean)
  const cli = candidates.find(candidate => existsSync(candidate))
  if (cli) {
    return { command: process.execPath, prefix: [cli] }
  }
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', prefix: [] }
}

function spawnNpm(args, options = {}) {
  const npm = resolveNpmInvocation()
  return spawnSync(npm.command, [...npm.prefix, ...args], {
    shell: false,
    ...options,
  })
}

function runGraftTests() {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'graft-test.js')], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  })
  if (r.status !== 0) {
    console.error('Pre-publish tests failed (node scripts/graft-test.js)')
    throw new Error(`Pre-publish tests failed (exit ${r.status ?? 1})`)
  }
}

function runReleaseCommand(command, args, label) {
  const r = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  })
  if (r.error || r.status !== 0) {
    throw new Error(
      `${label} failed${r.error ? `: ${r.error.message}` : ` (exit ${r.status ?? 1})`}`,
    )
  }
}

function runReleaseGates() {
  runReleaseCommand(
    process.execPath,
    [join(root, 'scripts', 'check-graft-brand.js')],
    'Brand/isolation gate',
  )
  runReleaseCommand(
    process.execPath,
    [join(root, 'scripts', 'build-npm-runtime.js')],
    'Bun runtime build',
  )
}

function npmWhoami() {
  const r = spawnNpm(['whoami'], { encoding: 'utf8' })
  if (r.status !== 0) return null
  return r.stdout.trim() || null
}

const packArtifact = process.argv.includes('--pack-artifact')
const dryRun = process.argv.includes('--dry-run') || packArtifact
if (!dryRun) {
  assertReleaseReady()
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
        `Package "${npmPkg.name}" on npm is owned by graft2 — use that account`,
        '(or an npm account added as a maintainer on https://www.npmjs.com/package/graft).',
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

  console.log('Running release brand, isolation, and runtime gates...')
  runReleaseGates()

  if (!dryRun) {
    console.log('Running pre-publish tests...')
    runGraftTests()
  }

  const args = dryRun
    ? packArtifact
      ? ['pack']
      : ['pack', '--dry-run']
    : ['publish', '--access', 'public']
  result = spawnNpm(args, { cwd: root, stdio: 'inherit' })
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  result = { status: 1 }
} finally {
  if (existsSync(backupPkg)) {
    copyFileSync(backupPkg, devPkgPath)
    rmSync(backupPkg, { force: true })
  }
  if (existsSync(backupReadme)) {
    copyFileSync(backupReadme, readmeMain)
    rmSync(backupReadme, { force: true })
  }
  rmSync(join(root, 'runtime'), { recursive: true, force: true })
}

if (result.status !== 0) {
  console.error(dryRun ? 'npm pack dry-run failed' : 'npm publish failed')
  process.exit(result.status ?? 1)
}

if (dryRun) {
  console.log(
    packArtifact
      ? `Package artifact ready — ${npmPkg.name}@${npmPkg.version}`
      : `Dry run OK — would publish ${npmPkg.name}@${npmPkg.version}`,
  )
} else {
  console.log(`Published ${npmPkg.name}@${npmPkg.version}`)
  console.log(`https://www.npmjs.com/package/${npmPkg.name}`)
}
