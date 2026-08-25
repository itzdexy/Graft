/**
 * Stand-in for Anthropic's `bun:bundle` feature() gate.
 *
 * This file backs `feature()` under `bun run` (via the bunfig [alias] entry).
 *
 * It previously claimed nine features were enabled. They were not. `Bun.build()`
 * does not apply bunfig aliases, so the bundler fell through to Bun's *native*
 * bun:bundle macro, which folds every `feature(...)` call to false and
 * dead-code-eliminates the branch. Every feature listed here was therefore
 * silently OFF in the shipped CLI while being ON under
 * `bun run entrypoints/cli.tsx` — and several of the ON branches referenced
 * symbols that were never ported, so the dev path threw where the shipped path
 * merely did nothing.
 *
 * Defaulting to off makes the two paths agree on the behaviour the codebase has
 * actually exercised, and makes this list honest.
 *
 * KNOWN LIMITATION: `TOVYR_FEATURES` only takes effect under `bun run`. In the
 * bundled CLI the gates are already folded to false at build time and no env
 * var can reopen them. Making the override work everywhere means importing
 * `feature` from a normal specifier instead of the `bun:` builtin namespace
 * (196 files), since plugins cannot intercept `bun:*`.
 */

/** Features enabled in every build. Add one only once it is verified to work. */
export const DEFAULT_FEATURES: readonly string[] = [
  // Memory extraction. Verified 2026-08-24: services/extractMemories imports
  // cleanly and every call site is additionally guarded by
  // isExtractModeActive(). With this off, no session ever wrote a memory file
  // — ~/.tovyr/projects/<project>/memory/ and MEMORY.md simply never appeared.
  'EXTRACT_MEMORIES',
]

/**
 * Features that exist in the tree but are not switched on. Kept as data so the
 * list is discoverable instead of implied by scattered `feature()` calls.
 */
export const KNOWN_FEATURES: readonly string[] = [
  'BUDDY',
  'MESSAGE_ACTIONS',
  'FORK_SUBAGENT',
  'WORKFLOW_SCRIPTS',
  'PROACTIVE',
  'MCP_SKILLS',
  'EXPERIMENTAL_SKILL_SEARCH',
  'HISTORY_SNIP',
  'EXTRACT_MEMORIES',
]

function envFeatures(): string[] {
  const raw = process.env.TOVYR_FEATURES?.trim()
  if (!raw) return []
  if (raw === '*' || raw.toLowerCase() === 'all') return [...KNOWN_FEATURES]
  return raw
    .split(',')
    .map(name => name.trim().toUpperCase())
    .filter(Boolean)
}

export function enabledFeatures(): Set<string> {
  return new Set([...DEFAULT_FEATURES, ...envFeatures()])
}

export function feature(name: string): boolean {
  return enabledFeatures().has(name)
}
