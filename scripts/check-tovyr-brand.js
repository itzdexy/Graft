#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ignored = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.cache',
  'runtime',
  '.tovyr',
  '.claude',
])
const textExtensions = new Set([
  '.cjs', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs',
  '.ps1', '.sh', '.toml', '.ts', '.tsx', '.txt', '.yaml', '.yml',
])
// Only flag the old product name, not the internal subsystem/feature flags.
const residue = /kairo[_ -]?code/i
const failures = []
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
  { pattern: /code\.claude\.com\/docs\/en\/chrome/i, label: 'foreign browser docs' },
  {
    pattern: /(?:command|spawn|execFile)\s*[:(]\s*['"]claude(?:\.exe)?['"]/i,
    label: 'foreign CLI launch',
  },
]

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    const relative = path.relative(root, absolute)
    if (/^installer[\\/]TovyrInstaller[\\/](?:bin|obj)(?:[\\/]|$)/i.test(relative)) {
      continue
    }
    if (residue.test(entry.name)) failures.push(`${relative} (path)`)
    if (entry.isDirectory()) {
      scan(absolute)
      continue
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue
    const content = fs.readFileSync(absolute, 'utf8')
    const normalizedRelative = relative.replaceAll('\\', '/')
    if (isolationTargets.has(normalizedRelative)) {
      isolationResidue.forEach(rule => {
        if (rule.pattern.test(content)) {
          failures.push(`${relative} (${rule.label})`)
        }
      })
    }
    content.split(/\r?\n/).forEach((line, index) => {
      if (relative.includes('check-tovyr-brand.js') && line.includes('residue')) return
      if (relative.includes('tovyrBuddy.ts') || relative.includes('tovyrBuddy.ts')) return
      if (residue.test(line)) failures.push(`${relative}:${index + 1}`)
    })
  }
}

scan(root)
if (failures.length > 0) {
  console.error(`TOVYR brand residue found in ${failures.length} location(s):`)
  console.error(failures.slice(0, 100).join('\n'))
  process.exitCode = 1
} else {
  console.log('TOVYR brand check passed.')
}
