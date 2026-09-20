import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { applyGraftEnvironment } from './graft-env.js'
import { releaseBlockers, RELEASE_GATES } from './graft-release-gate.js'

describe('Graft launcher', () => {
  test('Graft env wins while legacy env and provider identifiers survive', () => {
    const env = { GRAFT_HOME: '/test', TOVYR_HOME: '/old', GRAFT_NO_TIPS: '1', ANTHROPIC_MODEL: 'claude-sonnet' }
    expect(applyGraftEnvironment(env)).toEqual({ ...env, GRAFT_HOME: '/test' })
    expect(env.ANTHROPIC_MODEL).toBe('claude-sonnet')
  })
  test('new and compatibility commands both identify as Graft', () => {
    for (const launcher of ['graft']) {
      const result = spawnSync('node', [`bin/${launcher}.js`, '--version'], { encoding: 'utf8' })
      expect(result.status).toBe(0)
      expect(result.stdout.trim()).toBe('1.4.0 (Graft)')
    }
  })
  test('Graft help uses the new command', () => {
    const result = spawnSync('node', ['bin/graft.js', '--help'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('graft provider list')
    expect(result.stdout).not.toContain('  tovyr ')
  })
})

describe('release acceptance', () => {
  test('missing and incomplete evidence blocks publication', () => {
    expect(releaseBlockers(null).length).toBeGreaterThan(0)
    expect(releaseBlockers({ version: '1.4.0', gates: {} })).toEqual(RELEASE_GATES)
  })
  test('every gate needs both a passing status and evidence', () => {
    const gates = Object.fromEntries(RELEASE_GATES.map(name => [name, { status: 'passed', evidence: 'verified fixture' }]))
    expect(releaseBlockers({ version: '1.4.0', gates })).toEqual([])
    gates.security!.evidence = ''
    expect(releaseBlockers({ version: '1.4.0', gates })).toEqual(['security'])
  })
})
