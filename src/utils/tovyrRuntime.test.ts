import { afterEach, describe, expect, test } from 'bun:test'
import {
  isTovyrRuntime,
  isTovyrRuntimeFromSignals,
} from './tovyrRuntime.js'

const previousPackageRoot = process.env.TOVYR_PACKAGE_ROOT
const previousSourceRoot = process.env.TOVYR_SRC
const previousForceInteractive = process.env.TOVYR_FORCE_INTERACTIVE

afterEach(() => {
  if (previousPackageRoot === undefined) delete process.env.TOVYR_PACKAGE_ROOT
  else process.env.TOVYR_PACKAGE_ROOT = previousPackageRoot

  if (previousSourceRoot === undefined) delete process.env.TOVYR_SRC
  else process.env.TOVYR_SRC = previousSourceRoot

  if (previousForceInteractive === undefined) {
    delete process.env.TOVYR_FORCE_INTERACTIVE
  } else {
    process.env.TOVYR_FORCE_INTERACTIVE = previousForceInteractive
  }
})

describe('Tovyr runtime detection', () => {
  test('recognizes either source package name without launcher environment', () => {
    delete process.env.TOVYR_PACKAGE_ROOT
    delete process.env.TOVYR_SRC
    delete process.env.TOVYR_FORCE_INTERACTIVE

    expect(isTovyrRuntime()).toBe(true)
  })

  test('recognizes an explicit source root when package lookup is unavailable', () => {
    delete process.env.TOVYR_PACKAGE_ROOT
    process.env.TOVYR_SRC = import.meta.dir
    delete process.env.TOVYR_FORCE_INTERACTIVE

    expect(
      isTovyrRuntimeFromSignals({
        packageRoot: process.env.TOVYR_PACKAGE_ROOT,
        sourceRoot: process.env.TOVYR_SRC,
        forceInteractive: process.env.TOVYR_FORCE_INTERACTIVE,
        isTovyrPackage: false,
      }),
    ).toBe(true)
  })
})
