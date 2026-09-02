import { afterEach, describe, expect, test } from 'bun:test'
import {
  DEFAULT_FEATURES,
  KNOWN_FEATURES,
  UNAVAILABLE_FEATURES,
  enabledFeatures,
  feature,
} from './features.js'

const original = process.env.TOVYR_FEATURES

afterEach(() => {
  if (original === undefined) delete process.env.TOVYR_FEATURES
  else process.env.TOVYR_FEATURES = original
})

describe('feature flags', () => {
  test('nothing is on by default', () => {
    delete process.env.TOVYR_FEATURES
    expect(enabledFeatures().size).toBe(DEFAULT_FEATURES.length)
    for (const name of KNOWN_FEATURES) {
      expect(feature(name)).toBe(DEFAULT_FEATURES.includes(name))
    }
  })

  test('an unknown feature is always off', () => {
    delete process.env.TOVYR_FEATURES
    expect(feature('NOT_A_REAL_FEATURE')).toBe(false)
  })

  test('TOVYR_FEATURES enables named features', () => {
    process.env.TOVYR_FEATURES = 'BUDDY,WEB_BROWSER_TOOL'
    expect(feature('BUDDY')).toBe(true)
    expect(feature('WEB_BROWSER_TOOL')).toBe(true)
    expect(feature('AGENT_TRIGGERS')).toBe(false)
  })

  test('names are case-insensitive and whitespace tolerant', () => {
    process.env.TOVYR_FEATURES = ' buddy , web_browser_tool '
    expect(feature('BUDDY')).toBe(true)
    expect(feature('WEB_BROWSER_TOOL')).toBe(true)
  })

  test('"all" turns on every known feature', () => {
    process.env.TOVYR_FEATURES = 'all'
    for (const name of KNOWN_FEATURES) expect(feature(name)).toBe(true)
  })

  test('an empty value changes nothing', () => {
    process.env.TOVYR_FEATURES = '   '
    expect(enabledFeatures().size).toBe(DEFAULT_FEATURES.length)
  })
})

describe('feature() is reachable at runtime', () => {
  test('no source file imports feature from the bun:bundle builtin', async () => {
    // This is the bug that made every gate in the repo permanently false.
    // `bun:*` is a builtin namespace, so Bun resolves it before bunfig
    // `[alias]` entries: the alias pointing at the shim never applied, and
    // call sites got Bun's native macro instead, which folds feature(...) to
    // false at parse time and deletes the branch. TOVYR_FEATURES could not
    // reach it in the bundled CLI *or* under plain `bun run`.
    const { Glob } = await import('bun')
    const { fileURLToPath } = await import('node:url')
    const { dirname, sep } = await import('node:path')
    // URL.pathname yields "/C:/..." on Windows, which is not a real path.
    const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))

    // Built by concatenation so this file does not match its own check.
    const needle = "from '" + 'bun:bundle' + "'"
    const selfPath = fileURLToPath(import.meta.url)

    const offenders: string[] = []
    for await (const file of new Glob('**/*.{ts,tsx}').scan({
      cwd: repoRoot,
      absolute: true,
    })) {
      // .claude/worktrees holds separate checkouts of this same repo.
      if (file.includes(`${sep}node_modules${sep}`)) continue
      if (file.includes(`${sep}.claude${sep}`)) continue
      if (file === selfPath) continue
      const text = await Bun.file(file).text()
      if (text.includes(needle)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  }, 120_000)

  test('a gate flips with TOVYR_FEATURES rather than folding to a constant', () => {
    delete process.env.TOVYR_FEATURES
    expect(feature('WEB_BROWSER_TOOL')).toBe(false)
    process.env.TOVYR_FEATURES = 'WEB_BROWSER_TOOL'
    expect(feature('WEB_BROWSER_TOOL')).toBe(true)
  })
})

describe('gates match what is actually in the tree', () => {
  /**
   * Resolve every module a feature's branch requires.
   *
   * While feature() was a compile-time macro folded to false, a gate could
   * name a module that had never been ported and nothing would notice -- the
   * branch was deleted before anyone tried to load it. Now that the gates are
   * real, an unported one throws on startup instead, so the two lists in
   * features.ts have to stay true.
   */
  async function scanGates(): Promise<Map<string, string[]>> {
    const { Glob } = await import('bun')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join, resolve, sep } = await import('node:path')
    const { existsSync } = await import('node:fs')

    const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
    const missing = new Map<string, string[]>()

    const resolves = (spec: string, fromFile: string): boolean => {
      if (!spec.startsWith('.')) return true // bare package
      const base = resolve(dirname(fromFile), spec).replace(/\.js$/, '')
      return [
        `${base}.ts`,
        `${base}.tsx`,
        join(base, 'index.ts'),
        join(base, 'index.tsx'),
      ].some(existsSync)
    }

    for await (const file of new Glob('**/*.{ts,tsx}').scan({
      cwd: repoRoot,
      absolute: true,
    })) {
      if (file.includes(`${sep}node_modules${sep}`)) continue
      if (file.includes(`${sep}.claude${sep}`)) continue
      if (file.includes(`${sep}packages${sep}`)) continue
      const lines = (await Bun.file(file).text()).split('\n')
      for (let i = 0; i < lines.length; i++) {
        const gate = /feature\('([A-Z0-9_]+)'\)/.exec(lines[i]!)
        if (!gate) continue
        const name = gate[1]!
        // Stop at the next gate so a neighbouring one is not blamed.
        for (let j = i; j < Math.min(lines.length, i + 8); j++) {
          if (j > i && /feature\('[A-Z0-9_]+'\)/.test(lines[j]!)) break
          for (const m of lines[j]!.matchAll(
            /(?:require|import)\('([^']+)'\)/g,
          )) {
            const spec = m[1]!
            if (resolves(spec, file)) continue
            const list = missing.get(name) ?? []
            if (!list.includes(spec)) list.push(spec)
            missing.set(name, list)
          }
        }
      }
    }
    return missing
  }

  test('every enableable feature has all of its code', async () => {
    const missing = await scanGates()
    const broken = KNOWN_FEATURES.filter(name => missing.has(name)).map(
      name => `${name}: ${missing.get(name)!.join(', ')}`,
    )
    // A name here is reachable via TOVYR_FEATURES=* , so a missing module
    // means that command crashes the CLI on startup.
    expect(broken).toEqual([])
  }, 180_000)

  test('every feature listed unavailable is still referenced somewhere', async () => {
    // Deliberately weaker than "still has a missing module next to a gate".
    // Deleting an unreachable branch removes the only evidence a feature was
    // unported, which would make that stricter assertion fail the moment the
    // cleanup it exists to encourage actually happens. What stays true is
    // that a listed name should still be gating something -- once every call
    // site is gone, the entry is dead weight and should be dropped.
    const { Glob } = await import('bun')
    const { fileURLToPath } = await import('node:url')
    const { dirname, sep } = await import('node:path')
    const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))

    const seen = new Set<string>()
    for await (const file of new Glob('**/*.{ts,tsx}').scan({
      cwd: repoRoot,
      absolute: true,
    })) {
      if (file.includes(`${sep}node_modules${sep}`)) continue
      if (file.includes(`${sep}.claude${sep}`)) continue
      if (file.includes(`${sep}packages${sep}`)) continue
      if (file.endsWith(`${sep}features.ts`)) continue
      if (file.endsWith(`${sep}features.test.ts`)) continue
      const text = await Bun.file(file).text()
      for (const m of text.matchAll(/feature\('([A-Z0-9_]+)'\)/g)) {
        seen.add(m[1]!)
      }
    }
    const orphaned = UNAVAILABLE_FEATURES.filter(name => !seen.has(name))
    expect(orphaned).toEqual([])
  }, 180_000)

  test('an unavailable feature cannot be forced on via the env var', () => {
    process.env.TOVYR_FEATURES = 'PROACTIVE,WORKFLOW_SCRIPTS'
    expect(feature('PROACTIVE')).toBe(false)
    expect(feature('WORKFLOW_SCRIPTS')).toBe(false)
  })

  test('the two lists do not overlap', () => {
    const both = KNOWN_FEATURES.filter(n => UNAVAILABLE_FEATURES.includes(n))
    expect(both).toEqual([])
  })
})
