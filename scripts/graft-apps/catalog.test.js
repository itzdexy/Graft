import { describe, expect, test } from 'bun:test'
import { getAppAdapter, listAppAdapters } from './catalog.js'

describe('Graft application catalog', () => {
  test('lists every requested client exactly once', () => {
    expect(listAppAdapters().map(app => app.id)).toEqual([
      'codex', 'chatgpt', 'claude-code', 'claude-desktop', 'opencode',
      'hermes-agent', 'openclaw', 'droid', 'pi', 'kimi', 'copilot-cli',
      'openai-compatible',
    ])
  })

  test('does not claim hosted desktop chats support model routing', () => {
    expect(getAppAdapter('claude-desktop')).toMatchObject({
      integrationKind: 'tool-only', readiness: 'tool-only',
    })
    expect(getAppAdapter('chatgpt').integrationKind).toBe('model-routing')
  })

  test('returns defensive copies and null for unknown ids', () => {
    const first = getAppAdapter('CODEX')
    first.label = 'changed locally'
    expect(getAppAdapter('codex').label).not.toBe('changed locally')
    expect(getAppAdapter('does-not-exist')).toBeNull()
  })
})
