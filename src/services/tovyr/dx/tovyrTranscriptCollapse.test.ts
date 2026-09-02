import { describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ToolUseBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { Message } from '../../../types/message.js'
import {
  buildTovyrTranscriptContext,
  computeHiddenDuplicateTovyrAssistantTextUuids,
  computeHiddenTovyrWriteToolIds,
  tovyrWritePathVisible,
  lastTovyrCommittedAssistantDisplayText,
} from './tovyrTranscriptCollapse.js'
import type { MessageLookups } from '../../../utils/messages.js'

function writeTool(id: string, filePath: string): ToolUseBlockParam {
  return {
    type: 'tool_use',
    id,
    name: 'Write',
    input: { file_path: filePath, content: '<html></html>' },
  }
}

function assistantWithTools(...blocks: ToolUseBlockParam[]): Message {
  return {
    type: 'assistant',
    uuid: `uuid-${blocks[0]?.id ?? 'x'}` as Message['uuid'],
    message: {
      id: `msg-${blocks[0]?.id ?? 'x'}`,
      type: 'message',
      role: 'assistant',
      model: 'test',
      content: blocks,
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  }
}

function userPrompt(text: string): Message {
  return {
    type: 'user',
    uuid: 'user-1' as Message['uuid'],
    message: {
      role: 'user',
      content: [{ type: 'text', text }],
    },
  }
}

function assistantText(uuid: string, text: string): Message {
  return {
    type: 'assistant',
    uuid: uuid as Message['uuid'],
    message: {
      id: `msg-${uuid}`,
      type: 'message',
      role: 'assistant',
      model: 'test',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  }
}

function emptyLookups(errored: string[] = []): MessageLookups {
  return {
    siblingToolUseIDs: new Map(),
    progressMessagesByToolUseID: new Map(),
    inProgressHookCounts: new Map(),
    resolvedHookCounts: new Map(),
    toolResultByToolUseID: new Map(),
    toolUseByToolUseID: new Map(),
    normalizedMessageCount: 0,
    resolvedToolUseIDs: new Set(),
    erroredToolUseIDs: new Set(errored),
  }
}

describe('tovyrTranscriptCollapse', () => {
  test('hides duplicate Write rows for the same file', () => {
    const messages = [
      userPrompt('make me a landing page'),
      assistantWithTools(
        writeTool('w1', 'landing_page.html'),
        writeTool('w2', 'landing_page.html'),
      ),
    ]
    const hidden = computeHiddenTovyrWriteToolIds(messages, emptyLookups())
    expect(hidden.has('w1')).toBe(true)
    expect(hidden.has('w2')).toBe(false)
  })

  test('visibleWritePaths lists only non-hidden writes', () => {
    const messages = [
      userPrompt('make me a landing page'),
      assistantWithTools(
        writeTool('w1', 'landing_page.html'),
        writeTool('w2', 'landing_page.html'),
      ),
    ]
    const ctx = buildTovyrTranscriptContext(messages, emptyLookups())
    expect(ctx.visibleWritePaths.has('landing_page.html')).toBe(true)
    expect(ctx.visibleWritePaths.size).toBe(1)
    expect(tovyrWritePathVisible('landing_page.html', ctx.visibleWritePaths)).toBe(
      true,
    )
  })

  test('keeps writes to same basename in different directories separate', () => {
    const messages = [
      userPrompt('update both index files'),
      assistantWithTools(
        writeTool('w1', 'src/index.html'),
        writeTool('w2', 'lib/index.html'),
      ),
    ]
    const hidden = computeHiddenTovyrWriteToolIds(messages, emptyLookups())
    expect(hidden.has('w1')).toBe(false)
    expect(hidden.has('w2')).toBe(false)
  })

  test('hides failed landing writes when file exists on disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-collapse-'))
    try {
      const landing = join(dir, 'landing_page.html')
      await writeFile(
        landing,
        '<!DOCTYPE html><html><body><h1>Hello</h1><p>Enough content here for verify.</p></body></html>',
        'utf8',
      )
      const messages = [
        userPrompt('make me a html landing page fully'),
        assistantWithTools(
          writeTool('ok', 'landing_page.html'),
          writeTool('fail1', 'landing_page.html'),
          writeTool('fail2', 'index.html'),
        ),
      ]
      const hidden = computeHiddenTovyrWriteToolIds(
        messages,
        emptyLookups(['fail1', 'fail2']),
        dir,
      )
      expect(hidden.has('fail1')).toBe(true)
      expect(hidden.has('fail2')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('hides consecutive identical assistant text rows', () => {
    const dup =
      'The file is incomplete - it has placeholder comments instead of actual content.'
    const hidden = computeHiddenDuplicateTovyrAssistantTextUuids([
      assistantText('a1', dup),
      assistantText('a2', dup),
    ])
    expect(hidden.has('a1')).toBe(false)
    expect(hidden.has('a2')).toBe(true)
  })

  test('hides duplicate assistant text even when progress sits between', () => {
    const dup =
      "I'll build you a website with cool 3D scrolling animations. Let me check the working directory first, then create it."
    const progress = {
      type: 'progress',
      uuid: 'prog-1',
      data: { type: 'agent_progress' },
      toolUseID: 'x',
      timestamp: new Date().toISOString(),
    } as unknown as Message
    const hidden = computeHiddenDuplicateTovyrAssistantTextUuids([
      assistantText('a1', dup),
      progress,
      assistantText('a2', dup),
    ])
    expect(hidden.has('a1')).toBe(false)
    expect(hidden.has('a2')).toBe(true)
  })

  test('hides duplicate after a tool-only assistant row', () => {
    const dup = 'Creating the site now.'
    const hidden = computeHiddenDuplicateTovyrAssistantTextUuids([
      assistantText('a1', dup),
      assistantWithTools(writeTool('t1', 'index.html')),
      assistantText('a2', dup),
    ])
    expect(hidden.has('a1')).toBe(false)
    expect(hidden.has('a2')).toBe(true)
  })

  test('keeps distinct consecutive assistant text rows', () => {
    const hidden = computeHiddenDuplicateTovyrAssistantTextUuids([
      assistantText('a1', 'First paragraph.'),
      assistantText('a2', 'Second paragraph.'),
    ])
    expect(hidden.size).toBe(0)
  })

  test('resets duplicate chain after a user turn', () => {
    const dup = 'Same line again.'
    const hidden = computeHiddenDuplicateTovyrAssistantTextUuids([
      assistantText('a1', dup),
      userPrompt('fix it'),
      assistantText('a2', dup),
    ])
    expect(hidden.size).toBe(0)
  })

  test('lastTovyrCommittedAssistantDisplayText reads last prose row', () => {
    const text = lastTovyrCommittedAssistantDisplayText([
      userPrompt('hi'),
      assistantText('a1', '  Hello there.  '),
    ])
    expect(text).toBe('Hello there.')
  })
})
