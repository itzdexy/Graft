#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(currentFile), '..')
const ignored = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.cache',
  'runtime',
  '.tovyr',
  '.claude',
  '.superpowers',
  '.tovyr-test-build',
  '.build',
  'agents',
  'cloning',
  'terminals',
])
const textExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ps1',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])

const isolationTargets = new Set([
  'bin/tovyr.js',
  'bin/tovyr.cmd',
  'bin/install-tovyr.ps1',
  'package.npm.json',
  'scripts/tovyr-postinstall.js',
  'scripts/tovyr-warm.js',
  'scripts/tovyr-windows-launcher.js',
])
const isolationResidue = [
  { pattern: /(?:^|[\\/])\.claude(?:[\\/]|$)/i, label: 'foreign config path' },
  { pattern: /@anthropic-ai[\\/]claude-code/i, label: 'foreign CLI package' },
  { pattern: /claude-in-chrome/i, label: 'foreign browser extension' },
  {
    pattern: /code\.claude\.com\/docs\/en\/chrome/i,
    label: 'foreign browser docs',
  },
  {
    pattern: /(?:command|spawn|execFile)\s*[:(]\s*['"]claude(?:\.exe)?['"]/i,
    label: 'foreign CLI launch',
  },
]

/**
 * Return release-blocking brand problems for one text file.
 * Lowercase English "blink" remains valid for unrelated protocol language.
 */
export function scanText(content, relativePath) {
  const normalizedPath = relativePath.replaceAll('\\', '/')
  const findings = []
  const isCompatibilityBoundary = normalizedPath === 'src/buddy/tovyrBuddy.ts'

  if (/\b(?:Blink|BLINK)\b/.test(content)) {
    findings.push('legacy product name')
  }
  if (/\bitsdexy\/Tovyr\b/i.test(content)) {
    findings.push('stale repository reference')
  }
  if (!isCompatibilityBoundary && /kairo[_ -]?code/i.test(content)) {
    findings.push('legacy product name')
  }
  if (isolationTargets.has(normalizedPath)) {
    for (const rule of isolationResidue) {
      if (rule.pattern.test(content)) findings.push(rule.label)
    }
  }

  return [...new Set(findings)]
}

export function scanWorkspace(directory = root) {
  const failures = []

  function scan(currentDirectory) {
    for (const entry of fs.readdirSync(currentDirectory, {
      withFileTypes: true,
    })) {
      if (ignored.has(entry.name)) continue
      const absolute = path.join(currentDirectory, entry.name)
      const relative = path.relative(directory, absolute)
      const normalizedRelative = relative.replaceAll('\\', '/')
      if (
        /^installer\/TovyrInstaller\/(?:bin|obj)(?:\/|$)/i.test(
          normalizedRelative,
        )
      ) {
        continue
      }
      if (/\b(?:Blink|BLINK)\b/.test(entry.name)) {
        failures.push(`${relative} (legacy product path)`)
      }
      if (entry.isDirectory()) {
        scan(absolute)
        continue
      }
      if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue
      if (/^scripts\/check-tovyr-brand(?:\.test)?\.js$/.test(normalizedRelative)) {
        continue
      }

      const content = fs.readFileSync(absolute, 'utf8')
      const findings = scanText(content, normalizedRelative)
      for (const finding of findings) {
        failures.push(`${relative} (${finding})`)
      }
    }
  }

  scan(directory)
  return failures
}

function main() {
  const failures = scanWorkspace(root)
  if (failures.length > 0) {
    console.error(`TOVYR brand residue found in ${failures.length} location(s):`)
    console.error(failures.slice(0, 100).join('\n'))
    process.exitCode = 1
    return
  }
  console.log('TOVYR brand check passed.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  main()
}
