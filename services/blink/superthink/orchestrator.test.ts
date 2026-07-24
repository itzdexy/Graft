import { describe, expect, test } from 'bun:test'
import { buildSuperthinkResearchSubagentPrompt } from './researchSubagent.js'
import { runSuperthink } from './orchestrator.js'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('superthink research subagent', () => {
  test('prompt forbids fake tool syntax', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'blink-st-sub-'))
    const prompt = buildSuperthinkResearchSubagentPrompt(cwd, 'landing page')
    expect(prompt).toContain('WebSearch')
    expect(prompt).toContain('websearch.call')
    expect(prompt).toContain('research.md')
  })
})

describe('runSuperthink display vs query', () => {
  test('on/off/status/help are display-only (no model round-trip)', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'blink-st-orch-'))

    const on = await runSuperthink(cwd, 'on')
    expect(on.mode).toBe('display')
    if (on.mode === 'display') {
      expect(on.text).toContain('Superthinker ON')
    }

    const off = await runSuperthink(cwd, 'off')
    expect(off.mode).toBe('display')

    const status = await runSuperthink(cwd, 'status')
    expect(status.mode).toBe('display')
    if (status.mode === 'display') {
      expect(status.text).toContain('Superthinker mode')
    }

    const help = await runSuperthink(cwd, 'help')
    expect(help.mode).toBe('display')
    if (help.mode === 'display') {
      expect(help.text).toContain('Superthinker')
    }
  })

  test('new goal starts research subagent (not main model)', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'blink-st-orch-'))
    const result = await runSuperthink(cwd, 'what is obra superpowers')
    expect(result.mode).toBe('subagent')
    if (result.mode === 'subagent') {
      expect(result.phase).toBe('research')
      expect(result.goal).toContain('obra')
    }
  })
})
