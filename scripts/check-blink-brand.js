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
  '.blink',
])
const textExtensions = new Set([
  '.cjs', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs',
  '.ps1', '.sh', '.toml', '.ts', '.tsx', '.txt', '.yaml', '.yml',
])
const residue = /kairo(?:code)?|kairo[_ -]?code|\.kairo|KAIRO_/i
const failures = []

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    const relative = path.relative(root, absolute)
    if (/^installer[\\/]BlinkInstaller[\\/](?:bin|obj)(?:[\\/]|$)/i.test(relative)) {
      continue
    }
    if (residue.test(entry.name)) failures.push(`${relative} (path)`)
    if (entry.isDirectory()) {
      scan(absolute)
      continue
    }
    if (!textExtensions.has(path.extname(entry.name).toLowerCase())) continue
    const content = fs.readFileSync(absolute, 'utf8')
    content.split(/\r?\n/).forEach((line, index) => {
      if (relative === 'scripts\\check-blink-brand.js' && line.includes('const residue')) return
      if (residue.test(line)) failures.push(`${relative}:${index + 1}`)
    })
  }
}

scan(root)
if (failures.length > 0) {
  console.error(`Blink brand residue found in ${failures.length} location(s):`)
  console.error(failures.slice(0, 100).join('\n'))
  process.exitCode = 1
} else {
  console.log('Blink brand check passed.')
}
