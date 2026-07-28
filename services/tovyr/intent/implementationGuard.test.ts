import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildImplementationNudgeMessage,
  diskFileSatisfiesPrompt,
  formatTovyrRecoveryNotice,
  getLastUserPromptText,
  hadFailedFileWrite,
  hadSuccessfulFileWrite,
  implementationDeliveredOnDisk,
  isImplementationGuardEnabled,
  isUsefulFileOnDisk,
  tovyrWriteVerifiedOnDisk,
  shouldNudgeImplementationComplete,
  toolBatchHadFailedFileWrite,
  tryTovyrImplementationFileRecovery,
  tryRecoverFromFailedWriteTool,
  writeFailureSatisfiedOnDisk,
} from './implementationGuard.js'
import type { AssistantMessage, UserMessage } from '../../../types/message.js'

function userMessage(text: string, isMeta = false): UserMessage {
  return {
    type: 'user',
    isMeta,
    message: { role: 'user', content: text },
    uuid: 'u1',
    timestamp: '2026-01-01T00:00:00.000Z',
  }
}

function assistantWithTool(
  toolName: string,
  toolId: string,
): AssistantMessage {
  return {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: toolId, name: toolName, input: {} },
      ],
    },
    uuid: 'a1',
    timestamp: '2026-01-01T00:00:00.000Z',
  }
}

describe('implementationGuard', () => {
  test('getLastUserPromptText skips meta messages', () => {
    const messages = [
      userMessage('make me a html'),
      userMessage('hidden', true),
    ]
    expect(getLastUserPromptText(messages)).toBe('make me a html')
  })

  test('hadSuccessfulFileWrite requires file on disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-success-'))
    try {
      await writeFile(
        join(dir, 'index.html'),
        '<!DOCTYPE html><html><body>existing page</body></html>',
        'utf8',
      )
      const messages = [
        userMessage('make me a html'),
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Write',
                input: { file_path: 'index.html', content: '<html></html>' },
              },
            ],
          },
          uuid: 'a1',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'ok',
              },
            ],
          },
          uuid: 'u2',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]
      expect(hadSuccessfulFileWrite(messages, dir)).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('hadSuccessfulFileWrite ignores ghost-success without file on disk', () => {
    const messages = [
      userMessage('make me a html'),
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Write',
              input: { file_path: 'landing_page.html', content: '<html></html>' },
            },
          ],
        },
        uuid: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-1',
              content: 'ok',
            },
          ],
        },
        uuid: 'u2',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ]
    expect(hadSuccessfulFileWrite(messages)).toBe(false)
  })

  test('tovyrWriteVerifiedOnDisk rejects generic starter for showcase requests', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-showcase-'))
    try {
      const generic = `<!DOCTYPE html><html><body>
        <p>Created by Tovyr</p>
        <p>starter landing page scaffold</p>
        <h1>Welcome</h1>
      </body></html>`
      await writeFile(join(dir, 'index.html'), generic, 'utf8')
      const prompt = 'code me a agent showcase page website'
      expect(tovyrWriteVerifiedOnDisk('index.html', dir, prompt)).toBe(false)
      expect(diskFileSatisfiesPrompt(join(dir, 'index.html'), prompt)).toBe(
        false,
      )
      expect(
        implementationDeliveredOnDisk([userMessage(prompt)], [], [], dir),
      ).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('tryTovyrImplementationFileRecovery scaffolds landing page after ghost Write', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-landing-'))
    try {
      const messages = [userMessage('make me a html landing page fully')]
      const assistantMessages: AssistantMessage[] = [
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Write',
                input: {
                  file_path: 'landing_page.html',
                  content: '<!DOCTYPE html><html><body>hi</body></html>',
                },
              },
            ],
          },
          uuid: 'a1',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]
      const toolResults = [
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'Wrote file',
              },
            ],
          },
          uuid: 'u2',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]
      const result = await tryTovyrImplementationFileRecovery(
        messages,
        assistantMessages,
        'acceptEdits',
        [...toolResults],
        dir,
      )
      expect(result.wrote).toBe(true)
      if (result.wrote) {
        const html = await readFile(join(dir, 'landing_page.html'), 'utf8')
        expect(html).toContain('<!DOCTYPE html>')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('hadFailedFileWrite detects errored Write', () => {
    const messages = [
      userMessage('build a rust web server'),
      assistantWithTool('Write', 'tool-1'),
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-1',
              content: 'permission denied',
              is_error: true,
            },
          ],
        },
        uuid: 'u2',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ]
    expect(hadFailedFileWrite(messages)).toBe(true)
  })

  test('tryRecoverFromFailedWriteTool writes tool body to disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-recover-'))
    try {
      const messages = [
        userMessage('build main.rs'),
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Write',
                input: {
                  file_path: 'main.rs',
                  content: 'fn main() {\n    println!("hi");\n}\n',
                },
              },
            ],
          },
          uuid: 'a1',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'denied',
                is_error: true,
              },
            ],
          },
          uuid: 'u2',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]
      const result = await tryRecoverFromFailedWriteTool(messages, dir)
      expect(result.wrote).toBe(true)
      if (result.wrote) {
        const content = await readFile(join(dir, 'main.rs'), 'utf8')
        expect(content).toContain('println!("hi")')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('tryRecoverFromFailedWriteTool recovers failed Edit for new files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-recover-edit-'))
    try {
      const messages = [
        userMessage('make me a benchmark website'),
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Edit',
                input: {
                  file_path: 'index.html',
                  old_string: '',
                  new_string:
                    '<!DOCTYPE html><html><body><h1>Benchmark</h1></body></html>',
                },
              },
            ],
          },
          uuid: 'a1',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content:
                  '<tool_use_error>File does not exist. Note: your current working directory is /tmp.</tool_use_error>',
                is_error: true,
              },
            ],
          },
          uuid: 'u2',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]
      const result = await tryRecoverFromFailedWriteTool(messages, dir)
      expect(result.wrote).toBe(true)
      if (result.wrote) {
        const content = await readFile(join(dir, 'index.html'), 'utf8')
        expect(content).toContain('Benchmark')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('shouldNudge when implementation request ends without Write', () => {
    const messages = [userMessage('code me a agent showcase page website')]
    const assistantMessages: AssistantMessage[] = [
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: "I didn't create the Agent Showcase page website as it requires multiple tools and steps.",
            },
          ],
        },
        uuid: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ]
    const result = shouldNudgeImplementationComplete(
      messages,
      assistantMessages,
      'acceptEdits',
    )
    expect(result.nudge).toBe(true)
  })

  test('tryRecoverFromFailedWriteTool overwrites empty stub files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-recover-stub-'))
    try {
      await writeFile(join(dir, 'main.rs'), '', 'utf8')
      const messages = [
        userMessage('build main.rs'),
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Write',
                input: {
                  file_path: 'main.rs',
                  content: 'fn main() {\n    println!("hi");\n}\n',
                },
              },
            ],
          },
          uuid: 'a1',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'denied',
                is_error: true,
              },
            ],
          },
          uuid: 'u2',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]
      const result = await tryRecoverFromFailedWriteTool(messages, dir)
      expect(result.wrote).toBe(true)
      if (result.wrote) {
        const content = await readFile(join(dir, 'main.rs'), 'utf8')
        expect(content).toContain('println!("hi")')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('tryTovyrImplementationFileRecovery scaffolds rust after failed Write', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-recover-rust-'))
    try {
      const messages = [userMessage('tovyr build a rust web server')]
      const assistantMessages: AssistantMessage[] = [
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Write',
                input: { file_path: 'main.rs', content: 'tiny' },
              },
            ],
          },
          uuid: 'a1',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]
      const toolResults = [
        {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'permission denied',
                is_error: true,
              },
            ],
          },
          uuid: 'u2',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ] as const
      const result = await tryTovyrImplementationFileRecovery(
        messages,
        assistantMessages,
        'acceptEdits',
        [...toolResults],
        dir,
      )
      expect(result.wrote).toBe(true)
      if (result.wrote) {
        expect(result.source).toBe('starter')
        const main = await readFile(join(dir, 'src', 'main.rs'), 'utf8')
        expect(main).toContain('axum::serve')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('writeFailureSatisfiedOnDisk accepts rust scaffold paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-on-disk-'))
    try {
      const { tryImplementationFilesystemFallback } = await import(
        './implementationFallback.js'
      )
      await tryImplementationFilesystemFallback('build a rust web server', dir)
      expect(writeFailureSatisfiedOnDisk('main.rs', dir)).toBe(true)
      expect(isUsefulFileOnDisk(join(dir, 'src', 'main.rs'))).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('toolBatchHadFailedFileWrite detects errored Write in batch', () => {
    const blocks = [{ id: 'tool-1', name: 'Write' }]
    const results = [
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-1',
              content: 'nope',
              is_error: true,
            },
          ],
        },
        uuid: 'u1',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ]
    expect(toolBatchHadFailedFileWrite(blocks, results)).toBe(true)
  })

  test('should not nudge after successful Write', () => {
    const messages = [
      userMessage('make me a html'),
      assistantWithTool('Write', 'tool-1'),
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-1',
              content: 'ok',
            },
          ],
        },
        uuid: 'u2',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ]
    const result = shouldNudgeImplementationComplete(
      messages,
      [],
      'acceptEdits',
    )
    expect(result.nudge).toBe(false)
  })
})

describe('formatTovyrRecoveryNotice', () => {
  test('docs site mentions browser', () => {
    expect(
      formatTovyrRecoveryNotice('/proj/docs/index.html', 'starter', '/proj'),
    ).toContain('browser')
    expect(
      formatTovyrRecoveryNotice('/proj/docs/index.html', 'starter', '/proj'),
    ).toContain('docs/index.html')
  })

  test('after_failed_write prefixes message for recovered files', () => {
    const msg = formatTovyrRecoveryNotice(
      '/proj/index.html',
      'chat_dump',
      '/proj',
      'after_failed_write',
    )
    expect(msg.startsWith('Write failed,')).toBe(true)
    expect(msg).not.toContain('ask Tovyr to refine')
  })
})

describe('isImplementationGuardEnabled', () => {
  const prev = process.env.TOVYR_IMPLEMENTATION_GUARD

  afterEach(() => {
    if (prev === undefined) delete process.env.TOVYR_IMPLEMENTATION_GUARD
    else process.env.TOVYR_IMPLEMENTATION_GUARD = prev
  })

  test('on by default in Tovyr', () => {
    delete process.env.TOVYR_IMPLEMENTATION_GUARD
    expect(isImplementationGuardEnabled()).toBe(true)
  })

  test('off when TOVYR_IMPLEMENTATION_GUARD=0', () => {
    process.env.TOVYR_IMPLEMENTATION_GUARD = '0'
    expect(isImplementationGuardEnabled()).toBe(false)
  })
})
