/**
 * Legacy exports retained to avoid breaking callers in the public CLI.
 * Attribution is not suppressed by an organization-specific mode.
 */
export function isUndercover(): boolean {
  return false
}

export function getUndercoverInstructions(): string {
  return ''
}

export function shouldShowUndercoverAutoNotice(): boolean {
  return false
}
