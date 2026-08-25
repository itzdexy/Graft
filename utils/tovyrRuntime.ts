import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function isTovyrPackage(): boolean {
  try {
    const pkg = require('../package.json') as { name?: string }
    return pkg.name === 'tovyr' || pkg.name === 'tovyrcode'
  } catch {
    return false
  }
}

export interface TovyrRuntimeSignals {
  packageRoot: string | undefined
  sourceRoot: string | undefined
  forceInteractive: string | undefined
  isTovyrPackage: boolean
}

export function isTovyrRuntimeFromSignals({
  packageRoot,
  sourceRoot,
  forceInteractive,
  isTovyrPackage,
}: TovyrRuntimeSignals): boolean {
  return !!(
    packageRoot ||
    sourceRoot ||
    forceInteractive === '1' ||
    isTovyrPackage
  )
}

/** True when running Tovyr (Bun + source checkout), not stock Tovyr alone. */
export function isTovyrRuntime(): boolean {
  return isTovyrRuntimeFromSignals({
    packageRoot: process.env.TOVYR_PACKAGE_ROOT,
    sourceRoot: process.env.TOVYR_SRC,
    forceInteractive: process.env.TOVYR_FORCE_INTERACTIVE,
    isTovyrPackage: isTovyrPackage(),
  })
}

/** Tovyr.ai / Max-only surfaces should stay hidden in Tovyr. */
export function isTovyrWebOnlyCommandEnabled(): boolean {
  return !isTovyrRuntime()
}
