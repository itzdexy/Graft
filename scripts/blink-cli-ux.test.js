import { describe, expect, test } from 'bun:test'
import {
  EXIT,
  parseGlobalCliFlags,
  printMainHelp,
} from './blink-cli-ux.js'

describe('blink-cli-ux', () => {
  test('parseGlobalCliFlags strips quiet and sets env', () => {
    const prev = process.env.BLINK_QUIET
    const { argv, quiet } = parseGlobalCliFlags(['provider', 'list', '--quiet'])
    expect(quiet).toBe(true)
    expect(argv).toEqual(['provider', 'list'])
    expect(process.env.BLINK_QUIET).toBe('1')
    if (prev === undefined) delete process.env.BLINK_QUIET
    else process.env.BLINK_QUIET = prev
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
    expect(help).toContain('blink setup')
    expect(help).toContain('blink doctor')
    expect(help).toContain('--json')
    expect(help).toContain('Exit codes')
  })

  test('EXIT codes are documented values', () => {
    expect(EXIT.OK).toBe(0)
    expect(EXIT.ERROR).toBe(1)
    expect(EXIT.USAGE).toBe(2)
  })
})
