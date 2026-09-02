import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, join, relative } from 'path'
import { getCwd } from '../../../utils/cwd.js'
import { isTovyrRuntime } from '../../../utils/tovyrRuntime.js'
import {
  detectProjectScripts,
  formatProjectScripts,
  type ProjectScripts,
} from '../verify/projectScripts.js'

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'target',
  'venv',
  '.venv',
  '__pycache__',
  '.cache',
  'coverage',
  '.turbo',
  '.tovyr',
])

const MANIFEST_FILES = [
  'package.json',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'setup.py',
  'requirements.txt',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
] as const

export type ProjectScanResult = {
  cwd: string
  manifests: string[]
  projectType: string
  scripts: ProjectScripts | null
  topLevelDirs: string[]
  entryHints: string[]
  testHints: string[]
  configFiles: string[]
}

function listTopLevelDirs(cwd: string, max = 24): string[] {
  try {
    return readdirSync(cwd)
      .filter(name => {
        if (name.startsWith('.') && name !== '.github') return false
        const full = join(cwd, name)
        try {
          return statSync(full).isDirectory() && !IGNORED_DIRS.has(name)
        } catch {
          return false
        }
      })
      .slice(0, max)
  } catch {
    return []
  }
}

function detectManifests(cwd: string): string[] {
  return MANIFEST_FILES.filter(f => existsSync(join(cwd, f)))
}

function inferProjectType(manifests: string[]): string {
  if (manifests.includes('package.json')) return 'Node.js / JavaScript'
  if (manifests.includes('Cargo.toml')) return 'Rust'
  if (manifests.includes('go.mod')) return 'Go'
  if (
    manifests.includes('pyproject.toml') ||
    manifests.includes('setup.py') ||
    manifests.includes('requirements.txt')
  ) {
    return 'Python'
  }
  if (manifests.includes('pom.xml')) return 'Java (Maven)'
  if (manifests.includes('build.gradle') || manifests.includes('build.gradle.kts')) {
    return 'Java (Gradle)'
  }
  return 'unknown'
}

function findEntryHints(cwd: string): string[] {
  const hints: string[] = []
  const candidates = [
    'entrypoints/cli.tsx',
    'src/main.ts',
    'src/index.ts',
    'main.py',
    'cmd/main.go',
    'src/main.rs',
    'index.js',
  ]
  for (const rel of candidates) {
    if (existsSync(join(cwd, rel))) hints.push(rel)
  }
  if (existsSync(join(cwd, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as {
        main?: string
        bin?: Record<string, string>
      }
      if (pkg.main) hints.push(pkg.main)
      if (pkg.bin) {
        for (const p of Object.values(pkg.bin)) hints.push(p)
      }
    } catch {
      /* ignore */
    }
  }
  return [...new Set(hints)].slice(0, 8)
}

function findTestHints(cwd: string): string[] {
  const hints: string[] = []
  for (const dir of ['tests', 'test', '__tests__', 'spec']) {
    if (existsSync(join(cwd, dir))) hints.push(`${dir}/`)
  }
  return hints
}

function findConfigFiles(cwd: string): string[] {
  const names = [
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    'jest.config.js',
    'eslint.config.js',
    'eslint.config.mjs',
    '.eslintrc.json',
    'ruff.toml',
    'mypy.ini',
    'docker-compose.yml',
    'Dockerfile',
    'AGENTS.md',
    'tovyr.md',
    'TOVYRCODE.md',
  ]
  return names.filter(n => existsSync(join(cwd, n)))
}

/** Scan project layout for compact agent context (OpenCode / Aider inspired). */
export function scanProject(cwd = getCwd()): ProjectScanResult {
  const manifests = detectManifests(cwd)
  return {
    cwd,
    manifests,
    projectType: inferProjectType(manifests),
    scripts: detectProjectScripts(cwd),
    topLevelDirs: listTopLevelDirs(cwd),
    entryHints: findEntryHints(cwd),
    testHints: findTestHints(cwd),
    configFiles: findConfigFiles(cwd),
  }
}

export function formatProjectScan(result: ProjectScanResult): string {
  const lines: string[] = [
    `# Project scan (${basename(result.cwd) || result.cwd})`,
    '',
    `Type: ${result.projectType}`,
  ]

  if (result.manifests.length) {
    lines.push(`Manifests: ${result.manifests.join(', ')}`)
  }

  if (result.scripts) {
    lines.push('', '## Verify / scripts', '', formatProjectScripts(result.scripts))
  }

  if (result.entryHints.length) {
    lines.push('', '## Entry hints', ...result.entryHints.map(h => `- ${h}`))
  }

  if (result.testHints.length) {
    lines.push('', '## Tests', ...result.testHints.map(h => `- ${h}`))
  }

  if (result.configFiles.length) {
    lines.push('', '## Config', ...result.configFiles.map(h => `- ${h}`))
  }

  if (result.topLevelDirs.length) {
    lines.push('', '## Top-level folders', result.topLevelDirs.join(', '))
  }

  lines.push(
    '',
    'Use Read/Grep for details; respect .gitignore and avoid loading huge trees.',
  )

  return lines.join('\n')
}

/** Sync system-prompt section from project scan (disabled when TOVYR_PROJECT_SCAN=0). */
export function loadProjectScanSectionSync(cwd = getCwd()): string | null {
  if (!isTovyrRuntime()) return null
  if (process.env.TOVYR_PROJECT_SCAN === '0') return null

  try {
    const scan = scanProject(cwd)
    if (scan.manifests.length === 0 && scan.topLevelDirs.length === 0) {
      return null
    }
    return formatProjectScan(scan)
  } catch {
    return null
  }
}

/** Relative path for logs. */
export function projectScanLabel(cwd = getCwd()): string {
  return relative(process.cwd(), cwd) || basename(cwd) || cwd
}
