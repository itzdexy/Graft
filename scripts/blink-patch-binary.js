/**
 * Patch the bundled native runtime: Blink branding, colors, welcome text, version.
 * Same-length UTF-8 replacements only. Uses Buffer.indexOf (fast on large exes).
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLINK_VERSION } from '../constants/blink.js'
import { getBlinkPackageRoot, resolveClaudeNativeExe } from './blink-package-root.js'

const PATCH_REVISION = '3'

/** from → to must be identical byte length */
function buildReplacements() {
  const pairs = [
    ['Blink', 'Blink '],
    ['Welcome to Blink', 'Welcome to Blink '],
    ['Welcome back!', 'Hey, Blink!  '],
    ['Welcome back', 'Blink  '],
    ['API Usage Billing', 'FreeModel API    '],
    // Orange mascot + accent → cyan + violet (same byte length)
    ['rgb(215,119,87)', 'rgb(00,200,255)'],
    ['rgb(255,153,51)', 'rgb(180,70,255)'],
    ['Blink\'s official', 'FreeModel powered by'],
    ['Tips for getting started', 'Blink quickstart tips   '],
    ['CLAUDE.md', 'BLINK.md '],
  ]

  // Bundled runtime version from package.json (if present)
  try {
    const root = getBlinkPackageRoot()
    const pkgPath = join(
      root,
      'node_modules',
      '@anthropic-ai',
      'claude-code',
      'package.json',
    )
    if (existsSync(pkgPath)) {
      const upstream = JSON.parse(readFileSync(pkgPath, 'utf8')).version
      if (upstream && upstream !== BLINK_VERSION) {
        pairs.push([`v${upstream}`, `v${BLINK_VERSION}`])
        pairs.push([upstream, BLINK_VERSION])
      }
    }
  } catch {
    // ignore
  }

  return pairs
}

function patchBuffer(buf, from, to) {
  const fromBuf = Buffer.from(from, 'utf8')
  const toBuf = Buffer.from(to, 'utf8')
  if (fromBuf.length !== toBuf.length) {
    throw new Error(
      `Replacement length mismatch: "${from}" (${fromBuf.length}) vs "${to}" (${toBuf.length})`,
    )
  }

  let count = 0
  let offset = 0
  while (offset < buf.length) {
    const idx = buf.indexOf(fromBuf, offset)
    if (idx === -1) break
    toBuf.copy(buf, idx)
    count++
    offset = idx + fromBuf.length
  }
  return count
}

function markerPath() {
  return join(getBlinkPackageRoot(), '.blink-patched')
}

function readMarker() {
  const markerFile = markerPath()
  if (!existsSync(markerFile)) return null
  try {
    return readFileSync(markerFile, 'utf8').trim()
  } catch {
    return null
  }
}

function writeMarker(exePath) {
  const hash = createHash('sha256').update(readFileSync(exePath)).digest('hex')
  writeFileSync(
    markerPath(),
    `rev=${PATCH_REVISION}\n${exePath}\n${hash}\n`,
    'utf8',
  )
}

function needsPatch(buf) {
  const needles = [
    'Blink',
    'Welcome back!',
    'rgb(215,119,87)',
    'API Usage Billing',
    'Blink\'s official',
  ]
  return needles.some((n) => buf.includes(Buffer.from(n, 'utf8')))
}

export function patchClaudeBinaryBranding(exePath = resolveClaudeNativeExe()) {
  if (!exePath || !existsSync(exePath)) {
    return { patched: false, path: exePath, counts: {}, skipped: 'missing' }
  }

  const marker = readMarker()
  const buf = readFileSync(exePath)
  if (
    marker?.startsWith(`rev=${PATCH_REVISION}`) &&
    marker.includes(exePath) &&
    !needsPatch(buf)
  ) {
    return { patched: false, path: exePath, counts: {}, skipped: 'already' }
  }

  if (!needsPatch(buf) && marker?.includes(exePath)) {
    writeMarker(exePath)
    return { patched: false, path: exePath, counts: {}, skipped: 'already' }
  }

  const counts = {}
  let total = 0
  for (const [from, to] of buildReplacements()) {
    const n = patchBuffer(buf, from, to)
    if (n > 0) counts[from] = n
    total += n
  }

  if (total === 0) {
    return { patched: false, path: exePath, counts }
  }

  writeFileSync(exePath, buf)
  writeMarker(exePath)
  return { patched: true, path: exePath, counts }
}

if (process.argv[1]?.endsWith('blink-patch-binary.js')) {
  const result = patchClaudeBinaryBranding()
  if (!result.path) {
    console.error('claude native binary not found — install @anthropic-ai/claude-code first')
    process.exit(1)
  }
  if (result.skipped === 'already') {
    console.log(`Already patched: ${result.path}`)
  } else if (!result.patched) {
    console.log(`No branding strings to patch in ${result.path}`)
  } else {
    console.log(`Patched ${result.path}:`, result.counts)
  }
}
