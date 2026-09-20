import { afterEach, describe, expect, test } from 'bun:test'
import {
  isGraftRuntime,
  isGraftRuntimeFromSignals,
} from './graftRuntime.js'

const previousPackageRoot = process.env.GRAFT_PACKAGE_ROOT
const previousSourceRoot = process.env.GRAFT_SRC
const previousForceInteractive = process.env.GRAFT_FORCE_INTERACTIVE

afterEach(() => {
  if (previousPackageRoot === undefined) delete process.env.GRAFT_PACKAGE_ROOT
  else process.env.GRAFT_PACKAGE_ROOT = previousPackageRoot

  if (previousSourceRoot === undefined) delete process.env.GRAFT_SRC
  else process.env.GRAFT_SRC = previousSourceRoot

  if (previousForceInteractive === undefined) {
    delete process.env.GRAFT_FORCE_INTERACTIVE
  } else {
    process.env.GRAFT_FORCE_INTERACTIVE = previousForceInteractive
  }
})

describe('Graft runtime detection', () => {
  test('recognizes either source package name without launcher environment', () => {
    delete process.env.GRAFT_PACKAGE_ROOT
    delete process.env.GRAFT_SRC
    delete process.env.GRAFT_FORCE_INTERACTIVE

    expect(isGraftRuntime()).toBe(true)
  })

  test('recognizes an explicit source root when package lookup is unavailable', () => {
    delete process.env.GRAFT_PACKAGE_ROOT
    process.env.GRAFT_SRC = import.meta.dir
    delete process.env.GRAFT_FORCE_INTERACTIVE

    expect(
      isGraftRuntimeFromSignals({
        packageRoot: process.env.GRAFT_PACKAGE_ROOT,
        sourceRoot: process.env.GRAFT_SRC,
        forceInteractive: process.env.GRAFT_FORCE_INTERACTIVE,
        isGraftPackage: false,
      }),
    ).toBe(true)
  })
})
