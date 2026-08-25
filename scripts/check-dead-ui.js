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
 * exported prefetch/warm helpers. A general dead-export scan over this repo
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

const files = walk(ROOT)
const sources = new Map()
for (const f of files) {
  try { sources.set(f, readFileSync(f, 'utf8')) } catch { /* unreadable */ }
}

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
    const isWarmer = /^(prefetch|warm)[A-Z]/.test(name)
    if (isComponent || isWarmer) candidates.push({ name, rel })
  }
}

const dead = []
for (const { name, rel } of candidates) {
  let uses = 0
  for (const [file, src] of sources) {
    const other = relative(ROOT, file).split(sep).join('/')
    if (other === rel) continue
    // Substring match, not a word-boundary regex: these identifiers are
    // distinctive (TovyrXxx / prefetchXxx) so a substring hit is a real
    // reference, and it avoids escaping bugs in the pattern itself.
    if (src.includes(name)) uses++
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
