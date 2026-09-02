import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

test('REPL resolves the live silent-turn helper in a clean source graph', () => {
  const root = resolve(import.meta.dir, '../..')
  const repl = resolve(root, 'screens/REPL.tsx')
  const source = readFileSync(repl, 'utf8')
  const options = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext }
  const resolution = ts.resolveModuleName(
    '../services/tovyr/dx/silentTurn.js',
    repl,
    options,
    ts.sys,
  )

  expect(source).toContain("import { isSilentTurn } from '../services/tovyr/dx/silentTurn.js'")
  expect(resolution.resolvedModule?.resolvedFileName).toEndWith('services/tovyr/dx/silentTurn.ts')
})
