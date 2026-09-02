import { execFile, spawn } from 'node:child_process'
import type { AnthropicMessagesRequest } from './openaiCompat/convert.js'

type CodexEvent = {
  type?: string
  item?: {
    type?: string
    text?: string
  }
  message?: string
  error?: { message?: string }
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map(block => {
      if (!block || typeof block !== 'object') return ''
      const item = block as Record<string, unknown>
      if (item.type === 'text') return String(item.text || '')
      if (item.type === 'tool_result') {
        return `[tool result]\n${textFromContent(item.content)}`
      }
      if (item.type === 'tool_use') {
        return `[tool requested: ${String(item.name || 'unknown')}]\n${JSON.stringify(item.input || {})}`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function codexPrompt(body: AnthropicMessagesRequest): string {
  const system = textFromContent(body.system)
  const transcript = body.messages
    .map(message => {
      const role = message.role === 'assistant' ? 'ASSISTANT' : 'USER'
      return `${role}:\n${textFromContent(message.content)}`
    })
    .join('\n\n')

  return [
    'You are the model connected to Tovyr, a separate terminal coding agent.',
    'Respond only with the next assistant message for the conversation below.',
    'Do not edit files or run commands. Tovyr owns tools, permissions, and file changes.',
    system ? `TOVYR SYSTEM INSTRUCTIONS:\n${system}` : '',
    transcript,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function codexModel(model: string): string {
  return model.replace(/^openai\//, '')
}

function codexCommand(): string {
  return process.platform === 'win32' ? 'codex.exe' : 'codex'
}

const EXTERNAL_CLI_BLOCKED_ENV = /^(?:ANTHROPIC_|TOVYR_CODE_|TOVYR_ACTIVE_PROVIDER$|TOVYR_PROVIDER_AUTH_MODE$)/

export function buildIsolatedExternalCliEnv(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !EXTERNAL_CLI_BLOCKED_ENV.test(key)),
  )
}

export async function isCodexCliLoggedIn(): Promise<boolean> {
  return await new Promise(resolve => {
    execFile(
      codexCommand(),
      ['login', 'status'],
      {
        windowsHide: true,
        timeout: 10_000,
        env: buildIsolatedExternalCliEnv(),
      },
      (error, stdout, stderr) => {
        resolve(
          !error &&
            /logged in using chatgpt/i.test(`${stdout || ''}\n${stderr || ''}`),
        )
      },
    )
  })
}

export function startCodexCliLogin(): ReturnType<typeof spawn> {
  return spawn(codexCommand(), ['login'], {
    cwd: process.env.TOVYR_INVOKE_CWD || process.cwd(),
    windowsHide: true,
    stdio: 'ignore',
    env: buildIsolatedExternalCliEnv(),
  })
}

/**
 * Uses the installed official Codex CLI as the ChatGPT subscription transport.
 * Tovyr never reads or copies ~/.codex/auth.json; Codex owns login and refresh.
 */
export async function runCodexCliProvider(
  body: AnthropicMessagesRequest,
  signal?: AbortSignal,
): Promise<string> {
  const command = codexCommand()
  const cwd = process.env.TOVYR_INVOKE_CWD || process.cwd()
  const args = [
    '--ask-for-approval',
    'never',
    'exec',
    '--json',
    '--ephemeral',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check',
    '--ignore-rules',
    '-C',
    cwd,
    '-m',
    codexModel(body.model),
    '-',
  ]

  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: buildIsolatedExternalCliEnv(),
    })

    let stdout = ''
    let stderr = ''
    let finalText = ''
    let settled = false

    const abort = () => {
      if (settled) return
      child.kill()
    }
    signal?.addEventListener('abort', abort, { once: true })

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
      let newline = stdout.indexOf('\n')
      while (newline >= 0) {
        const line = stdout.slice(0, newline).trim()
        stdout = stdout.slice(newline + 1)
        if (line) {
          try {
            const event = JSON.parse(line) as CodexEvent
            if (
              event.type === 'item.completed' &&
              event.item?.type === 'agent_message' &&
              event.item.text
            ) {
              finalText = event.item.text
            }
          } catch {
            // Codex JSONL may include a non-JSON diagnostic line; stderr is
            // still included if the command ultimately fails.
          }
        }
        newline = stdout.indexOf('\n')
      }
    })
    child.stderr.on('data', chunk => {
      stderr = `${stderr}${chunk}`.slice(-4_000)
    })
    child.on('error', error => {
      settled = true
      signal?.removeEventListener('abort', abort)
      reject(
        new Error(
          `Could not start the official Codex CLI: ${error.message}. Run tovyr auth login --provider codex.`,
        ),
      )
    })
    child.on('close', code => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      if (signal?.aborted) {
        reject(new DOMException('ChatGPT request cancelled', 'AbortError'))
      } else if (code !== 0) {
        reject(
          new Error(
            stderr.trim() ||
              `Codex CLI exited with code ${code}. Run tovyr auth login --provider codex.`,
          ),
        )
      } else if (!finalText.trim()) {
        reject(new Error('Codex CLI returned no assistant message.'))
      } else {
        resolve(finalText.trim())
      }
    })

    child.stdin.end(codexPrompt(body))
  })
}
