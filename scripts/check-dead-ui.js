#!/usr/bin/env node
/**
 * Flag UI components and warmers that are defined but never referenced.
 *
 * On 2026-08-24 four finished pieces of Tovyr shipped with zero call sites:
 * TovyrGitHubUpdateNotice, TovyrSilentTurnNotice, prefetchActiveProviderModelIds,
 * and the streamingThinking prop path. Each was valid TypeScript and passed
 * every test — an unmounted export is not a type error, so neither tsc nor the
 * unit suite can see it. The user found all four by launching the app and
 * reporting "it doesn't show anything".
 *
 * This is deliberately narrow: exported components under components/tovyr and
 * exported Tovyr-runtime prefetch/warm helpers. A general dead-export scan over this repo
 * produces hundreds of hits (SDK surface, re-exports, ant-only paths) and gets
 * ignored, which is worse than not running it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.claude', 'dist', 'build-output', 'packages', 'website', 'vendor',
])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const SOURCE_ROOTS = [
  'commands', 'components', 'entrypoints', 'hooks', 'performance', 'screens',
  'services', 'tools', 'utils',
]
const SOURCE_FILES = ['commands.ts', 'main.tsx', 'query.ts', 'tools.ts']
const files = [
  ...SOURCE_ROOTS.flatMap(dir => {
  const full = join(ROOT, dir)
  try {
    return statSync(full).isDirectory() ? walk(full) : []
  } catch {
    return []
  }
  }),
  ...SOURCE_FILES.map(file => join(ROOT, file)).filter(file => {
    try { return statSync(file).isFile() } catch { return false }
  }),
]
const sources = new Map()
for (const f of files) {
  const rel = relative(ROOT, f).split(sep).join('/')
  if (/\.(?:test|spec)\.tsx?$/.test(rel)) continue
  try { sources.set(f, readFileSync(f, 'utf8')) } catch { /* unreadable */ }
}

/** Replace comments and quoted literals so prose cannot masquerade as a call site. */
function codeOnly(source) {
  let output = ''
  let index = 0
  let state = 'code'
  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]
    if (state === 'code') {
      if (char === '/' && next === '/') { state = 'line'; output += '  '; index += 2; continue }
      if (char === '/' && next === '*') { state = 'block'; output += '  '; index += 2; continue }
      if (char === "'" || char === '"' || char === '`') { state = char; output += ' '; index++; continue }
      output += char
      index++
      continue
    }
    if (state === 'line') {
      if (char === '\n') { state = 'code'; output += '\n' } else output += ' '
      index++
      continue
    }
    if (state === 'block') {
      if (char === '*' && next === '/') { state = 'code'; output += '  '; index += 2 } else { output += char === '\n' ? '\n' : ' '; index++ }
      continue
    }
    if (char === '\\') { output += '  '; index += 2; continue }
    if (char === state) { state = 'code'; output += ' '; index++ } else { output += char === '\n' ? '\n' : ' '; index++ }
  }
  return output
}

function hasProductionReference(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:<\\s*${escaped}(?=\\s|/|>)|\\b${escaped}\\b)`).test(source)
}

const productionCode = new Map(
  [...sources].map(([file, source]) => {
    const withoutImports = source
      .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    return [file, codeOnly(withoutImports)]
  }),
)

/** Exported names we care about, with the file that defines them. */
const candidates = []
for (const [file, src] of sources) {
  const rel = relative(ROOT, file).split(sep).join('/')
  if (/\.test\.tsx?$/.test(rel)) continue

  const isTovyrComponent = rel.startsWith('components/tovyr/')
  for (const m of src.matchAll(
    /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)|export\s+const\s+([A-Za-z0-9_]+)\s*[:=]/g,
  )) {
    const name = m[1] ?? m[2]
    if (!name) continue
    const isComponent = isTovyrComponent && /^Tovyr[A-Z]/.test(name)
    const isWarmer =
      rel.startsWith('services/tovyr/') && /^(prefetch|warm)[A-Z]/.test(name)
    if (isComponent || isWarmer) candidates.push({ name, rel })
  }
}

const dead = []
for (const { name, rel } of candidates) {
  let uses = 0
  for (const [file, src] of productionCode) {
    const other = relative(ROOT, file).split(sep).join('/')
    if (other === rel) continue
    if (hasProductionReference(src, name)) uses++
  }
  if (uses === 0) dead.push({ name, rel })
}

/**
 * The check intentionally has no legacy exemptions. A component or warmer
 * must have a reachable caller before it can land in the workbench.
 */
const BASELINE = new Set([])

const fresh = dead.filter(d => !BASELINE.has(d.name))
const stale = [...BASELINE].filter(name => !dead.some(d => d.name === name))

if (stale.length > 0) {
  console.log(
    `check-dead-ui: ${stale.length} baseline entries are now referenced — ` +
      `remove from BASELINE: ${stale.join(", ")}`,
  )
}

if (fresh.length === 0) {
  console.log(
    `check-dead-ui: no NEW unreferenced components (${dead.length} baselined).`,
  )
  process.exit(0)
}

console.error('check-dead-ui: these are defined but never referenced anywhere:')
for (const { name, rel } of fresh) console.error(`  ${name}  (${rel})`)
console.error(
  'Either wire it into the UI or delete it. A finished component with no ' +
  'call site is the exact shape of bug this check exists to catch.',
)
process.exit(1)
