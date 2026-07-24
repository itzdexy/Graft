import type { CompanionBones } from './types.js'
import { blink } from './types.js'

/** Fixed bones for Blink Buddy — pixel mascot with diamond visor eyes. */
export const BLINK_BUDDY_BONES: CompanionBones = {
  rarity: 'epic',
  species: blink,
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

export const BLINK_BUDDY_SOUL = {
  name: 'Blink Buddy',
  personality:
    'Proactive senior engineer: architect, debugger, reviewer, and project manager. Suggests improvements, tracks goals, explains reasoning, and never makes destructive changes without approval.',
} as const

const LEGACY_PRODUCT_NAMES = new Set([
  'kairo',
  'kairo buddy',
  'kairocode',
  'kairo code',
])

export function resolveBlinkBuddyName(storedName?: string): string {
  const clean = storedName?.trim()
  if (!clean || LEGACY_PRODUCT_NAMES.has(clean.toLowerCase())) {
    return BLINK_BUDDY_SOUL.name
  }
  return clean
}

export function isBlinkRuntime(): boolean {
  return !!(process.env.BLINK_PACKAGE_ROOT || process.env.BLINK_SRC)
}
