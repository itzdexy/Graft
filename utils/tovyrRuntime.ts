import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function isTovyrPackage(): boolean {
  try {
    const pkg = require('../package.json') as { name?: string }
    return pkg.name === 'tovyrcode' || pkg.name === 'tovyrcode'
  } catch {
    return false
  }
}

/** True when running Tovyr (Bun + source checkout), not stock Tovyr alone. */
export function isTovyrRuntime(): boolean {
  return !!(
    process.env.TOVYR_PACKAGE_ROOT ||
    process.env.TOVYR_SRC ||
    process.env.TOVYR_FORCE_INTERACTIVE === '1' ||
    isTovyrPackage()
  )
}

/** Tovyr.ai / Max-only surfaces should stay hidden in Tovyr. */
export function isTovyrWebOnlyCommandEnabled(): boolean {
  return !isTovyrRuntime()
}
