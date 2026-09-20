import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function isGraftPackage(): boolean {
  try {
    const pkg = require('../../package.json') as { name?: string }
    return pkg.name === 'graft' || pkg.name === 'graft' || pkg.name === 'graftcode'
  } catch {
    return false
  }
}

export interface GraftRuntimeSignals {
  packageRoot: string | undefined
  sourceRoot: string | undefined
  forceInteractive: string | undefined
  isGraftPackage: boolean
}

export function isGraftRuntimeFromSignals({
  packageRoot,
  sourceRoot,
  forceInteractive,
  isGraftPackage,
}: GraftRuntimeSignals): boolean {
  return !!(
    packageRoot ||
    sourceRoot ||
    forceInteractive === '1' ||
    isGraftPackage
  )
}

/** True when running Graft (Bun + source checkout), not stock Graft alone. */
export function isGraftRuntime(): boolean {
  return isGraftRuntimeFromSignals({
    packageRoot: process.env.GRAFT_PACKAGE_ROOT,
    sourceRoot: process.env.GRAFT_SRC,
    forceInteractive: process.env.GRAFT_FORCE_INTERACTIVE,
    isGraftPackage: isGraftPackage(),
  })
}

/** Graft.ai / Max-only surfaces should stay hidden in Graft. */
export function isGraftWebOnlyCommandEnabled(): boolean {
  return !isGraftRuntime()
}
