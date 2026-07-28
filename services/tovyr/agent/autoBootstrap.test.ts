import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  ensureAgentSessionForPrompt,
  formatAgentBootstrapNotice,
  hasActiveTovyrAgentSession,
  isAgentSessionRelevantToPrompt,
  pauseAgentSessionIfCasual,
  shouldAutoBootstrapAgent,
} from './autoBootstrap.js'
import { clearAgentSession } from './persistence.js'

describe('autoBootstrap', () => {
  let cwd: string

  afterEach(() => {
    if (cwd) {
      clearAgentSession(cwd)
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  test('shouldAutoBootstrapAgent for implementation prompts', () => {
    expect(shouldAutoBootstrapAgent('code me a calculator on python')).toBe(true)
    expect(shouldAutoBootstrapAgent('hello')).toBe(false)
    expect(shouldAutoBootstrapAgent('/agent start x')).toBe(false)
  })

  test('ensureAgentSessionForPrompt creates autofix session', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-agent-boot-'))
    const session = ensureAgentSessionForPrompt('code me a calculator on python', cwd)
    expect(session).not.toBeNull()
    expect(session!.autoFix).toBe(true)
    expect(session!.steps.length).toBeGreaterThan(3)
    expect(session!.steps[session!.currentStepIndex]?.status).toBe('in_progress')
    expect(formatAgentBootstrapNotice(session!)).toContain('Agent mode')
  })

  test('reuses active session for same goal', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-agent-boot-'))
    const first = ensureAgentSessionForPrompt('build a rust web server', cwd)
    const second = ensureAgentSessionForPrompt('build a rust web server', cwd)
    expect(second?.id).toBe(first?.id)
  })

  test('pauses agent session on casual chat', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-agent-boot-'))
    ensureAgentSessionForPrompt('code me a calculator on python', cwd)
    expect(hasActiveTovyrAgentSession(cwd)).toBe(true)
    expect(isAgentSessionRelevantToPrompt('hi', cwd)).toBe(false)
    pauseAgentSessionIfCasual('hi', cwd)
    expect(hasActiveTovyrAgentSession(cwd)).toBe(false)
  })

  test('resumes paused session for the same goal', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-agent-boot-'))
    const first = ensureAgentSessionForPrompt('code me a calculator on python', cwd)
    pauseAgentSessionIfCasual('hi', cwd)
    const resumed = ensureAgentSessionForPrompt(
      'code me a calculator on python',
      cwd,
    )
    expect(resumed?.id).toBe(first?.id)
    expect(hasActiveTovyrAgentSession(cwd)).toBe(true)
  })
})
