import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export type VerifyCheckKind = 'typecheck' | 'lint' | 'test' | 'build'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export type VerifyCheck = {
  kind: VerifyCheckKind
  label: string
  /** Executable (e.g. npm, bun, cargo) */
  command: string
  args: string[]
}

export type ProjectScripts = {
  packageManager?: PackageManager
  checks: VerifyCheck[]
  source: string
}

const SCRIPT_KIND_MAP: Array<{
  kind: VerifyCheckKind
  keys: string[]
}> = [
  { kind: 'typecheck', keys: ['typecheck', 'check:types', 'tsc', 'types'] },
  { kind: 'lint', keys: ['lint', 'eslint', 'lint:fix'] },
  { kind: 'test', keys: ['test', 'test:unit', 'test:ci', 'unit'] },
  { kind: 'build', keys: ['build', 'compile', 'dist'] },
]

export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, 'bun.lock')) || existsSync(join(cwd, 'bun.lockb'))) {
    return 'bun'
  }
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

function checkFromScript(
  pm: PackageManager,
  kind: VerifyCheckKind,
  scriptKey: string,
  scriptValue: string,
): VerifyCheck {
  const base = runViaPackageManager(pm, scriptKey)
  return {
    ...base,
    kind,
    label: `${base.label} (${scriptValue})`,
  }
}

function runViaPackageManager(pm: PackageManager, scriptName: string): Omit<VerifyCheck, 'kind'> {
  switch (pm) {
    case 'bun':
      return {
        label: `bun run ${scriptName}`,
        command: 'bun',
        args: ['run', scriptName],
      }
    case 'pnpm':
      return {
        label: `pnpm run ${scriptName}`,
        command: 'pnpm',
        args: ['run', scriptName],
      }
    case 'yarn':
      return {
        label: `yarn ${scriptName}`,
        command: 'yarn',
        args: [scriptName],
      }
    default:
      return {
        label: `npm run ${scriptName}`,
        command: 'npm',
        args: ['run', scriptName],
      }
  }
}

function detectNodeScripts(cwd: string): ProjectScripts | null {
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return null
  let pkg: { scripts?: Record<string, string> }
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return null
  }
  const scripts = pkg.scripts ?? {}
  const pm = detectPackageManager(cwd)
  const checks: VerifyCheck[] = []
  const usedKinds = new Set<VerifyCheckKind>()

  for (const { kind, keys } of SCRIPT_KIND_MAP) {
    if (usedKinds.has(kind)) continue
    const key = keys.find(k => scripts[k] !== undefined)
    if (!key) continue
    checks.push(checkFromScript(pm, kind, key, scripts[key]!))
    usedKinds.add(kind)
  }

  if (!checks.length && scripts.test === undefined && existsSync(join(cwd, 'node_modules'))) {
    checks.push({
      kind: 'test',
      label: `${pm} test (fallback)`,
      command: pm === 'npm' ? 'npm' : pm,
      args: pm === 'yarn' ? ['test'] : pm === 'npm' ? ['test'] : ['test'],
    })
  }

  return { packageManager: pm, checks, source: 'package.json' }
}

function detectCargo(cwd: string): ProjectScripts | null {
  if (!existsSync(join(cwd, 'Cargo.toml'))) return null
  return {
    checks: [
      { kind: 'test', label: 'cargo test', command: 'cargo', args: ['test'] },
      { kind: 'build', label: 'cargo build', command: 'cargo', args: ['build'] },
      { kind: 'lint', label: 'cargo clippy', command: 'cargo', args: ['clippy', '--', '-D', 'warnings'] },
    ],
    source: 'Cargo.toml',
  }
}

function detectGo(cwd: string): ProjectScripts | null {
  if (!existsSync(join(cwd, 'go.mod'))) return null
  return {
    checks: [
      { kind: 'test', label: 'go test ./...', command: 'go', args: ['test', './...'] },
      { kind: 'build', label: 'go build ./...', command: 'go', args: ['build', './...'] },
    ],
    source: 'go.mod',
  }
}

function detectPython(cwd: string): ProjectScripts | null {
  const hasPy =
    existsSync(join(cwd, 'pyproject.toml')) ||
    existsSync(join(cwd, 'setup.py')) ||
    existsSync(join(cwd, 'requirements.txt'))
  if (!hasPy) return null
  const checks: VerifyCheck[] = []
  if (existsSync(join(cwd, 'pyproject.toml'))) {
    checks.push({
      kind: 'test',
      label: 'pytest',
      command: 'pytest',
      args: [],
    })
  }
  return checks.length ? { checks, source: 'python' } : null
}

/** Discover test/lint/build/typecheck commands for the current project. */
export function detectProjectScripts(cwd: string): ProjectScripts {
  return (
    detectNodeScripts(cwd) ??
    detectCargo(cwd) ??
    detectGo(cwd) ??
    detectPython(cwd) ?? { checks: [], source: 'none' }
  )
}

export function formatProjectScripts(scripts: ProjectScripts): string {
  if (!scripts.checks.length) {
    return 'No automatic verify commands detected. Use Read on package.json or ask the user which commands to run.'
  }
  return [
    `Detected from ${scripts.source}${scripts.packageManager ? ` (${scripts.packageManager})` : ''}:`,
    ...scripts.checks.map(c => `- **${c.kind}**: \`${c.command} ${c.args.join(' ')}\``),
  ].join('\n')
}
