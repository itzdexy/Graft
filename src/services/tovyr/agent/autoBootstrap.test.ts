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
  resolveAgentTurnPolicy,
  shouldAutoBootstrapAgent,
} from './autoBootstrap.js'
import {
  clearAgentSession,
  loadAgentSession,
  saveAgentSession,
} from './persistence.js'

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

  test('handles okay checkpoint replies before casual-chat classification', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-agent-boot-'))
    const session = ensureAgentSessionForPrompt(
      'build a full authentication frontend, backend, tests, and documentation across multiple files',
      cwd,
    )
    expect(session?.orchestration?.state).toBe('ideating')

    session!.orchestration!.state = 'awaiting_idea'
    saveAgentSession(session!)
    expect(isAgentSessionRelevantToPrompt('okay', cwd)).toBe(true)
    const planning = ensureAgentSessionForPrompt('okay', cwd)
    expect(planning?.id).toBe(session?.id)
    expect(planning?.orchestration?.state).toBe('drafting_plan')

    planning!.orchestration!.state = 'awaiting_plan'
    saveAgentSession(planning!)
    expect(isAgentSessionRelevantToPrompt('ok', cwd)).toBe(true)
    const building = ensureAgentSessionForPrompt('ok', cwd)
    expect(building?.orchestration?.state).toBe('building')
    expect(building?.phase).toBe('execute')
  })

  test('a greeting never answers a pending approval', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-agent-boot-'))
    const session = ensureAgentSessionForPrompt(
      'build a full authentication frontend, backend, tests, and documentation across multiple files',
      cwd,
    )
    session!.orchestration!.state = 'awaiting_idea'
    saveAgentSession(session!)

    // Reported: typing "hi" against a parked session came back as a
    // three-approach execution plan.
    expect(isAgentSessionRelevantToPrompt('hi', cwd)).toBe(false)
    expect(ensureAgentSessionForPrompt('hi', cwd)).toBeNull()
    // The session must not have advanced.
    expect(loadAgentSession(cwd)?.orchestration?.state).toBe('awaiting_idea')

    // And a greeting parks the mission so its brief stops leaking in.
    pauseAgentSessionIfCasual('hi', cwd)
    expect(loadAgentSession(cwd)?.phase).toBe('paused')
  })

  test('approvals still advance a parked orchestration', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-agent-boot-'))
    const session = ensureAgentSessionForPrompt(
      'build a full authentication frontend, backend, tests, and documentation across multiple files',
      cwd,
    )
    session!.orchestration!.state = 'awaiting_idea'
    saveAgentSession(session!)
    // "ok" is an approval, not a greeting — it must still be consumed.
    expect(isAgentSessionRelevantToPrompt('ok', cwd)).toBe(true)
    expect(ensureAgentSessionForPrompt('ok', cwd)?.orchestration?.state).toBe(
      'drafting_plan',
    )
  })

  test('makes planner turns read-only without changing build-turn code mode', () => {
    cwd = mkdtempSync(join(tmpdir(), 'tovyr-agent-boot-'))
    const session = ensureAgentSessionForPrompt(
      'build a full authentication frontend, backend, tests, and documentation across multiple files',
      cwd,
    )

    expect(resolveAgentTurnPolicy(session!, 'acceptEdits')).toEqual({
      permissionMode: 'plan',
      suppressCodeModeNotice: true,
      plannerReadOnly: true,
    })

    // An explicit bypass is a deliberate user override, not a default the
    // planner may take back — silently downgrading it made the footer read
    // Bypass while writes failed with 'mode: plan'.
    expect(resolveAgentTurnPolicy(session!, 'bypassPermissions')).toEqual({
      permissionMode: 'bypassPermissions',
      suppressCodeModeNotice: false,
    })

    session!.orchestration!.state = 'building'
    session!.phase = 'execute'
    expect(resolveAgentTurnPolicy(session!, 'acceptEdits')).toEqual({
      permissionMode: 'acceptEdits',
      suppressCodeModeNotice: false,
    })
  })
})
