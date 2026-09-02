/**
 * Runtime feature gates.
 *
 * These used to be imported from `bun:bundle`, which does not work. `bun:*` is
 * a builtin namespace: Bun resolves it before bunfig `[alias]` entries, so the
 * alias pointing at build/feature-shim.ts never applied and every call site
 * got Bun's *native* macro instead. That macro folds `feature(...)` to `false`
 * at parse time and dead-code-eliminates the branch -- in the bundled CLI and
 * under plain `bun run` alike. The practical effect was that every gated
 * feature in this repo was permanently off, `TOVYR_FEATURES` did nothing, and
 * the shim's documented env override was unreachable code.
 *
 * A normal specifier is resolvable, aliasable, and testable, so the gates now
 * mean what they say. The trade-off is that gated branches are no longer
 * dead-code-eliminated from the bundle; that is the correct exchange for
 * gates that can actually be turned on.
 */

/**
 * Features enabled in every build.
 *
 * Add one only after verifying the code behind it loads and runs -- several
 * gates in this tree still reference modules that were never ported, and
 * enabling those crashes rather than doing nothing.
 */
export const DEFAULT_FEATURES: readonly string[] = [
  // Memory extraction. Every call site is additionally guarded by
  // isExtractModeActive(). With this off, no session ever wrote a memory file
  // -- ~/.tovyr/projects/<project>/memory/ and MEMORY.md simply never appeared.
  'EXTRACT_MEMORIES',
  'TRANSCRIPT_CLASSIFIER',
  'UDS_INBOX',
]

/**
 * Gates whose code is present and loads. Only these may be switched on.
 *
 * `TOVYR_FEATURES=*` expands to exactly this list, so anything here must
 * actually work -- see UNAVAILABLE_FEATURES for why that is not a given.
 */
export const KNOWN_FEATURES: readonly string[] = [
  'AGENT_TRIGGERS',
  'AGENT_TRIGGERS_REMOTE',
  'BUDDY',
  'EXTRACT_MEMORIES',
  'MESSAGE_ACTIONS',
  'WEB_BROWSER_TOOL',
]

/**
 * Gates whose implementation was never ported into this fork.
 *
 * These are not "off by default" -- they cannot be turned on at all. Each one
 * guards a `require()` of a module that does not exist, so enabling it throws
 * at load time rather than doing nothing. That was harmless while `feature()`
 * was a compile-time macro folded to false; once the gates became real runtime
 * checks, `TOVYR_FEATURES=*` or a hopeful `TOVYR_FEATURES=PROACTIVE` would
 * crash the CLI on startup.
 *
 * Refusing them here keeps that impossible, and keeps the reason discoverable
 * instead of buried in a stack trace. utils/features.test.ts walks the tree and
 * fails if a name in KNOWN_FEATURES has a missing module, or if a name listed
 * here turns out to be complete after all -- move it up when its code lands.
 *
 * Three tiers, then: KNOWN_FEATURES is enableable and covered by `*`; the
 * names here are refused outright; anything in neither is an unverified
 * opt-in that `*` will not touch but `TOVYR_FEATURES=NAME` still enables.
 */
export const UNAVAILABLE_FEATURES: readonly string[] = [
  'AUTO_THEME',
  'BG_SESSIONS',
  'CACHED_MICROCOMPACT',
  'COMMIT_ATTRIBUTION',
  'CONTEXT_COLLAPSE',
  'DAEMON',
  'DIRECT_CONNECT',
  'EXPERIMENTAL_SKILL_SEARCH',
  'FORK_SUBAGENT',
  'HISTORY_SNIP',
  'KAIROS',
  'MCP_SKILLS',
  'MEMORY_SHAPE_TELEMETRY',
  'MONITOR_TOOL',
  'OVERFLOW_TEST_TOOL',
  'PROACTIVE',
  'REACTIVE_COMPACT',
  'REVIEW_ARTIFACT',
  'SSH_REMOTE',
  'TEMPLATES',
  'TERMINAL_PANEL',
  'TORCH',
  'TOVYRS',
  'TOVYRS_GITHUB_WEBHOOKS',
  'UDS_INBOX',
  'VOICE_MODE',
  'WORKFLOW_SCRIPTS',
]

function envFeatures(): string[] {
  const raw = process.env.TOVYR_FEATURES?.trim()
  if (!raw) return []
  if (raw === '*' || raw.toLowerCase() === 'all') return [...KNOWN_FEATURES]
  return raw
    .split(',')
    .map(name => name.trim().toUpperCase())
    .filter(Boolean)
    // An unported gate cannot be honoured: its branch requires a module that
    // is not in the tree, so turning it on throws instead of enabling
    // anything.
    .filter(name => !UNAVAILABLE_FEATURES.includes(name))
}

/**
 * Recomputed per call rather than memoized: tests flip TOVYR_FEATURES between
 * cases, and the cost is a string split on an env var.
 */
export function enabledFeatures(): Set<string> {
  return new Set([...DEFAULT_FEATURES, ...envFeatures()])
}

export function feature(name: string): boolean {
  return enabledFeatures().has(name)
}
