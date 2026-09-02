import type { CompanionBones } from './types.js'
import { tovyr } from './types.js'

/** Fixed bones for TOVYR Buddy — pixel mascot with diamond visor eyes. */
export const TOVYR_BUDDY_BONES: CompanionBones = {
  rarity: 'epic',
  species: tovyr,
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

export const TOVYR_BUDDY_SOUL = {
  name: 'Tovyr Buddy',
  personality:
    'Proactive senior engineer: architect, debugger, reviewer, and project manager. Suggests improvements, tracks goals, explains reasoning, and never makes destructive changes without approval.',
} as const

const LEGACY_PRODUCT_NAMES = new Set([
  'kairo',
  'kairo buddy',
  'tovyrcode',
  'kairo code',
  'tovyr',
  'tovyr buddy',
  'tovyr code',
  'claude',
])

export function resolveTovyrBuddyName(storedName?: string): string {
  const clean = storedName?.trim()
  if (!clean || LEGACY_PRODUCT_NAMES.has(clean.toLowerCase())) {
    return TOVYR_BUDDY_SOUL.name
  }
  return clean
}

export { isTovyrRuntime } from '../utils/tovyrRuntime.js'
