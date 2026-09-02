import { describe, expect, test } from 'bun:test'
import {
  isCodingToolName,
  isResearchToolName,
  resolveClawdMood,
} from './ActivityClawd.js'

describe('resolveClawdMood', () => {
  test('talking while working in ask/default mode', () => {
    expect(resolveClawdMood({ isWorking: true, permissionMode: 'default' })).toBe(
      'talking',
    )
  })

  test('laptop coding while working in acceptEdits', () => {
    expect(
      resolveClawdMood({ isWorking: true, permissionMode: 'acceptEdits' }),
    ).toBe('coding')
  })

  test('Write/Edit tools force coding even in ask mode', () => {
    expect(
      resolveClawdMood({
        isWorking: true,
        permissionMode: 'default',
        activeToolNames: ['Write'],
      }),
    ).toBe('coding')
  })

  test('research glasses+laptop when Explore/read tools are active', () => {
    expect(
      resolveClawdMood({
        isWorking: true,
        permissionMode: 'default',
        activeToolNames: ['Explore'],
      }),
    ).toBe('researching')
    expect(
      resolveClawdMood({
        isWorking: true,
        permissionMode: 'acceptEdits',
        activeToolNames: ['Grep', 'Read'],
      }),
    ).toBe('researching')
  })

  test('research beats coding when both tool families are active', () => {
    expect(
      resolveClawdMood({
        isWorking: true,
        permissionMode: 'acceptEdits',
        activeToolNames: ['Write', 'Explore'],
      }),
    ).toBe('researching')
  })

  test('planning while working in plan mode without research tools', () => {
    expect(resolveClawdMood({ isWorking: true, permissionMode: 'plan' })).toBe(
      'planning',
    )
  })

  test('idle random fidget when waiting in ask mode', () => {
    expect(
      resolveClawdMood({ isWorking: false, permissionMode: 'default' }),
    ).toBe('idle')
  })

  test('listening when idle in code or plan', () => {
    expect(
      resolveClawdMood({ isWorking: false, permissionMode: 'acceptEdits' }),
    ).toBe('listening')
    expect(resolveClawdMood({ isWorking: false, permissionMode: 'plan' })).toBe(
      'listening',
    )
  })
})

describe('tool name classifiers', () => {
  test('isResearchToolName', () => {
    expect(isResearchToolName('Explore')).toBe(true)
    expect(isResearchToolName('Grep')).toBe(true)
    expect(isResearchToolName('WebSearch')).toBe(true)
    expect(isResearchToolName('Bash')).toBe(false)
    expect(isResearchToolName('Edit')).toBe(false)
  })

  test('isCodingToolName', () => {
    expect(isCodingToolName('Write')).toBe(true)
    expect(isCodingToolName('Edit')).toBe(true)
    expect(isCodingToolName('Bash')).toBe(true)
    expect(isCodingToolName('Explore')).toBe(false)
  })
})
