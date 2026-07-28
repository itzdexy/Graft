import { describe, expect, test } from 'bun:test'
import {
  EXIT,
  parseGlobalCliFlags,
  printMainHelp,
} from './tovyr-cli-ux.js'

describe('tovyr-cli-ux', () => {
  test('parseGlobalCliFlags strips quiet and sets env', () => {
    const prev = process.env.TOVYR_QUIET
    const { argv, quiet } = parseGlobalCliFlags(['provider', 'list', '--quiet'])
    expect(quiet).toBe(true)
    expect(argv).toEqual(['provider', 'list'])
    expect(process.env.TOVYR_QUIET).toBe('1')
    if (prev === undefined) delete process.env.TOVYR_QUIET
    else process.env.TOVYR_QUIET = prev
  })

  test('parseGlobalCliFlags strips json flag', () => {
    const { argv, json } = parseGlobalCliFlags(['config', '--json'])
    expect(json).toBe(true)
    expect(argv).toEqual(['config'])
  })

  test('printMainHelp includes key commands', () => {
    const help = (() => {
      const lines = []
      const orig = console.log
      console.log = (...args) => lines.push(args.join(' '))
      printMainHelp()
      console.log = orig
      return lines.join('\n')
    })()
    expect(help).toContain('tovyr setup')
    expect(help).toContain('tovyr doctor')
    expect(help).toContain('--json')
    expect(help).toContain('Exit codes')
  })

  test('EXIT codes are documented values', () => {
    expect(EXIT.OK).toBe(0)
    expect(EXIT.ERROR).toBe(1)
    expect(EXIT.USAGE).toBe(2)
  })
})
