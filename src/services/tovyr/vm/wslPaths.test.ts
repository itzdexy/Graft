import { describe, expect, test } from 'bun:test'
import {
  defaultDistro,
  parseWslDistros,
  quoteForBash,
  toWslPath,
} from './wslPaths.js'

const REAL_OUTPUT = [
  '  NAME              STATE           VERSION',
  '* Ubuntu            Stopped         2',
  '  docker-desktop    Stopped         2',
].join('\r\n')

describe('parseWslDistros', () => {
  test('parses real wsl -l -v output', () => {
    const distros = parseWslDistros(REAL_OUTPUT)
    expect(distros).toHaveLength(2)
    expect(distros[0]).toEqual({
      name: 'Ubuntu',
      state: 'Stopped',
      version: 2,
      isDefault: true,
    })
    expect(distros[1]?.isDefault).toBe(false)
  })

  test('strips the NULs Windows leaves in UTF-16 output', () => {
    const withNuls = REAL_OUTPUT.split('').join('\0')
    expect(parseWslDistros(withNuls)).toHaveLength(2)
  })

  test('handles distro names containing spaces', () => {
    const out = ['  NAME  STATE  VERSION', '* Ubuntu 22.04 LTS  Running  2'].join(
      '\n',
    )
    expect(parseWslDistros(out)[0]?.name).toBe('Ubuntu 22.04 LTS')
  })

  test('ignores blank and malformed rows', () => {
    expect(parseWslDistros('NAME STATE VERSION\n\n   \ngarbage\n')).toEqual([])
  })

  test('returns empty for empty input', () => {
    expect(parseWslDistros('')).toEqual([])
  })
})

describe('defaultDistro', () => {
  test('prefers the starred distro', () => {
    expect(defaultDistro(parseWslDistros(REAL_OUTPUT))?.name).toBe('Ubuntu')
  })

  test('falls back to the first when none is starred', () => {
    const distros = parseWslDistros('NAME STATE VERSION\n  Alpine  Running  2')
    expect(defaultDistro(distros)?.name).toBe('Alpine')
  })

  test('returns null with no distros', () => {
    expect(defaultDistro([])).toBeNull()
  })
})

describe('toWslPath', () => {
  test('maps a drive path to its mount point', () => {
    expect(toWslPath('C:\\Users\\me\\proj')).toBe('/mnt/c/Users/me/proj')
    expect(toWslPath('E:\\Medal')).toBe('/mnt/e/Medal')
  })

  test('lowercases only the drive letter, preserving case elsewhere', () => {
    expect(toWslPath('D:\\MyApp\\SrcFile')).toBe('/mnt/d/MyApp/SrcFile')
  })

  test('handles a bare drive root', () => {
    expect(toWslPath('C:\\')).toBe('/mnt/c')
  })

  test('accepts forward slashes', () => {
    expect(toWslPath('C:/Users/me')).toBe('/mnt/c/Users/me')
  })

  test('passes an existing POSIX path through unchanged', () => {
    // Translating twice must not corrupt the path.
    expect(toWslPath('/mnt/c/Users/me')).toBe('/mnt/c/Users/me')
    expect(toWslPath(toWslPath('C:\\Users\\me'))).toBe('/mnt/c/Users/me')
  })

  test('rejects UNC paths, which WSL cannot reach', () => {
    expect(() => toWslPath('\\\\server\\share')).toThrow(/UNC/)
  })

  test('rejects relative paths rather than guessing a root', () => {
    expect(() => toWslPath('src\\index.ts')).toThrow(/absolute/)
  })
})

describe('quoteForBash', () => {
  test('wraps plain values', () => {
    expect(quoteForBash('ls -la')).toBe("'ls -la'")
  })

  test('escapes embedded single quotes', () => {
    // The standard idiom: close the quote, emit an escaped quote, reopen.
    expect(quoteForBash("it's")).toBe(String.raw`'it'\''s'`)
  })

  test('leaves shell metacharacters inert', () => {
    const quoted = quoteForBash('$(rm -rf /) `whoami` $HOME')
    expect(quoted.startsWith("'")).toBe(true)
    expect(quoted.endsWith("'")).toBe(true)
    // No unescaped quote can terminate the string early.
    expect(quoted.slice(1, -1).includes("'")).toBe(false)
  })

  test('handles newlines', () => {
    expect(quoteForBash('a\nb')).toBe("'a\nb'")
  })
})
