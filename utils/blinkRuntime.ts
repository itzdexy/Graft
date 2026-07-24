import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function isBlinkPackage(): boolean {
  try {
    const pkg = require('../../package.json') as { name?: string }
    return pkg.name === 'blinkcode'
  } catch {
    return false
  }
}

/** True when running Blink (Bun + source checkout), not stock Blink alone. */
export function isBlinkRuntime(): boolean {
  return !!(
    process.env.BLINK_PACKAGE_ROOT ||
    process.env.BLINK_SRC ||
    process.env.BLINK_FORCE_INTERACTIVE === '1' ||
    isBlinkPackage()
  )
}

/** Blink.ai / Max-only surfaces should stay hidden in Blink. */
export function isBlinkWebOnlyCommandEnabled(): boolean {
  return !isBlinkRuntime()
}
