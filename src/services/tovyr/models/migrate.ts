/**
 * Alias migration for model settings written by older Tovyr versions.
 *
 * Migration is intentionally separate from resolution so a migration row can be
 * retired without touching model data, and so callers can distinguish "the user
 * asked for a legacy name" from "the user asked for a current name".
 */

import { LEGACY_ALIAS_MIGRATIONS } from './registry.data.js'

/** Guards against a cycle in the migration table. */
const MAX_MIGRATION_HOPS = 8

export type AliasMigration = {
  /** The alias after following the migration chain. */
  alias: string
  /** Every alias traversed, starting with the caller's input. */
  chain: string[]
  /** True when at least one hop was taken. */
  migrated: boolean
}

/**
 * Follow the legacy-alias chain to a current alias.
 *
 * Unknown inputs are returned unchanged with `migrated: false` — this function
 * never invents an alias, because silently substituting a model the user did
 * not ask for is exactly the failure mode the registry exists to prevent.
 */
export function migrateAlias(input: string): AliasMigration {
  const start = input.trim()
  const chain: string[] = [start]
  let current = start

  for (let hop = 0; hop < MAX_MIGRATION_HOPS; hop++) {
    const next = LEGACY_ALIAS_MIGRATIONS[current]
    if (next === undefined || next === current) break
    if (chain.includes(next)) {
      // Cycle in the migration table: stop at the last stable value rather
      // than looping. Treated as "no further migration".
      break
    }
    chain.push(next)
    current = next
  }

  return { alias: current, chain, migrated: current !== start }
}

/** True when `input` is a legacy alias with a defined replacement. */
export function isLegacyAlias(input: string): boolean {
  return migrateAlias(input).migrated
}
