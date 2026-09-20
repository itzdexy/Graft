import type { CompanionBones } from './types.js'
import { graft } from './types.js'

/** Fixed bones for GRAFT Buddy — pixel mascot with diamond visor eyes. */
export const GRAFT_BUDDY_BONES: CompanionBones = {
  rarity: 'epic',
  species: graft,
  eye: '◆',
  hat: 'none',
  shiny: true,
  stats: {
    DEBUGGING: 92,
    PATIENCE: 88,
    CHAOS: 12,
    WISDOM: 95,
    SNARK: 35,
  },
}

export const GRAFT_BUDDY_SOUL = {
  name: 'Graft Buddy',
  personality:
    'Proactive senior engineer: architect, debugger, reviewer, and project manager. Suggests improvements, tracks goals, explains reasoning, and never makes destructive changes without approval.',
} as const

const LEGACY_PRODUCT_NAMES = new Set([
  'kairo',
  'kairo buddy',
  'graftcode',
  'kairo code',
  'graft',
  'graft buddy',
  'graft code',
  'claude',
])

export function resolveGraftBuddyName(storedName?: string): string {
  const clean = storedName?.trim()
  if (!clean || LEGACY_PRODUCT_NAMES.has(clean.toLowerCase())) {
    return GRAFT_BUDDY_SOUL.name
  }
  return clean
}

export { isGraftRuntime } from '../utils/graftRuntime.js'
