import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  openAiChatCompletionsUrl,
  openAiModelsUrl,
} from '../../../../scripts/graft-provider-upstream.js'
import {
  anthropicError,
  anthropicRequestToOpenAi,
  openAiCompletionToAnthropic,
  openAiStreamToAnthropicEvents,
  type AnthropicMessagesRequest,
} from './convert.js'
import { preflightAnthropicRequestContext } from '../modelContext.js'
import { classifyProviderError } from '../providerErrors.js'
import { runCodexCliProvider } from '../codexCliProvider.js'
import { getProvider } from '../../../../scripts/graft-providers.js'

// Opt-in proxy tracing. Set GRAFT_PROXY_DEBUG=1 to append the upstream request
// summary and the raw upstream response to .graft/proxy-debug.log in the
// project. Lets us see exactly what the model emitted (tool_calls vs. text) and
// confirm this patched proxy is the code actually running.
const PROXY_DEBUG = process.env.GRAFT_PROXY_DEBUG === '1'

function proxyDebugLog(label: string, data: unknown): void {
  if (!PROXY_DEBUG) return
  try {
    const dir = join(process.cwd(), '.graft')
    mkdirSync(dir, { recursive: true })
    const line =
      `\n[${new Date().toISOString()}] ${label}\n` +
      (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) +
      '\n'
    appendFileSync(join(dir, 'proxy-debug.log'), line)
  } catch {
    // Never let logging break the request path.
  }
}

function looksLikeContextLengthError(message: string): boolean {
  return /context (?:length|window)|maximum context|too many tokens|reduce the length|input tokens/i.test(
    message,
  )
}

function formatContextLengthMessage(
  model: string,
  originalMessage: string,
): string {
  const details = originalMessage.trim()
  return [
    `Graft could not send this turn because ${model} is out of context.`,
    'Try /compact, /clear, switching to a larger-context model with /model, or starting a fresh session in this project.',
    details ? `Provider detail: ${details}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export type OpenAiCompatProxyConfig = {
  providerId: string
  upstreamBaseUrl: string
  upstreamApiKey: string
  authMode?: 'apiKey' | 'authToken' | 'oauth'
}

let activeServer: ReturnType<typeof Bun.serve> | null = null
let activeConfig: OpenAiCompatProxyConfig | null = null
let activeUrl: string | null = null

/** Bun.serve rejects idleTimeout above 255 (seconds). */
export const BUN_SERVE_MAX_IDLE_TIMEOUT_SEC = 255

export function openAiCompatProxyConfigsEqual(
  a: OpenAiCompatProxyConfig | null,
  b: OpenAiCompatProxyConfig,
): boolean {
  return (
    !!a &&
    a.providerId === b.providerId &&
    a.upstreamBaseUrl === b.upstreamBaseUrl &&
    a.upstreamApiKey === b.upstreamApiKey &&
    a.authMode === b.authMode
  )
}

export function getOpenAiCompatProxyUrl(): string | null {
  return activeUrl
}

export function stopOpenAiCompatProxy(): void {
  activeServer?.stop()
  activeServer = null
  activeConfig = null
  activeUrl = null
  delete process.env.GRAFT_OPENAI_COMPAT_PROXY
}

async function forwardModels(config: OpenAiCompatProxyConfig): Promise<Response> {
  if (config.providerId === 'openai' && config.authMode === 'oauth') {
    const provider = getProvider('openai')
    return new Response(
      JSON.stringify({
        object: 'list',
        data: (provider?.models || []).map(model => ({
          id: model.id,
          object: 'model',
          owned_by: 'openai',
        })),
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )
  }

  try {
    const response = await fetch(openAiModelsUrl(config.upstreamBaseUrl), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.upstreamApiKey}`,
        'x-request-id': randomUUID(),
      },
      signal: AbortSignal.timeout(15_000),
    })
    const text = await response.text()
    return new Response(text, {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'Upstream models request failed'
    return anthropicError(502, `OpenAI-compat upstream unreachable: ${msg}`)
  }
}

async function handleMessages(
  req: Request,
  config: OpenAiCompatProxyConfig,
): Promise<Response> {
  let body: AnthropicMessagesRequest
  try {
    body = (await req.json()) as AnthropicMessagesRequest
  } catch {
    return anthropicError(400, 'Invalid JSON body')
  }

  if (!body.model || !body.max_tokens) {
    return anthropicError(400, 'model and max_tokens are required')
  }

  if (config.providerId === 'openai' && config.authMode === 'oauth') {
    try {
      const text = await runCodexCliProvider(body, req.signal)
      if (!body.stream) {
        return new Response(
          JSON.stringify({
            id: `msg_${randomUUID()}`,
            type: 'message',
            role: 'assistant',
            model: body.model,
            content: [{ type: 'text', text }],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          }),
          { headers: { 'content-type': 'application/json' } },
        )
      }

      const id = `msg_${randomUUID()}`
      const events = [
        ['message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } }],
        ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
        ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
        ['content_block_stop', { type: 'content_block_stop', index: 0 }],
        ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 0 } }],
        ['message_stop', { type: 'message_stop' }],
      ] as const
      const payload = events
        .map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        .join('')
      return new Response(payload, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'ChatGPT connection failed'
      return anthropicError(401, message, 'authentication_error')
    }
  }

  const preflight = preflightAnthropicRequestContext(body, config.providerId)
  if (!preflight.ok) {
    return anthropicError(413, preflight.message, 'invalid_request_error')
  }

  const openAiBody = anthropicRequestToOpenAi(body, config.providerId)
  proxyDebugLog('REQUEST →upstream', {
    model: openAiBody.model,
    stream: openAiBody.stream,
    tool_choice: openAiBody.tool_choice,
    toolCount: openAiBody.tools?.length ?? 0,
    messageCount: openAiBody.messages.length,
  })
  const upstreamSignal = req.signal
    ? AbortSignal.any([req.signal, AbortSignal.timeout(600_000)])
    : AbortSignal.timeout(600_000)
  let upstream: Response
  try {
    upstream = await fetch(openAiChatCompletionsUrl(config.upstreamBaseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.upstreamApiKey}`,
        'content-type': 'application/json',
        'x-request-id': randomUUID(),
      },
      body: JSON.stringify(openAiBody),
      signal: upstreamSignal,
    })
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'Upstream chat request failed'
    const errorName = error instanceof Error ? error.name : undefined
    const classified = classifyProviderError({
      message: msg,
      errorName,
      status: errorName === 'AbortError' ? 499 : 502,
    })
    const isAbort = classified.kind === 'cancelled'
    return anthropicError(
      isAbort ? 499 : 502,
      classified.userMessage || `OpenAI-compat upstream: ${msg}`,
    )
  }

  if (!upstream.ok) {
    const errText = await upstream.text()
    let message = errText.slice(0, 500) || `Upstream HTTP ${upstream.status}`
    try {
      const parsed = JSON.parse(errText) as {
        error?: { message?: string }
        message?: string
      }
      message = parsed.error?.message || parsed.message || message
    } catch {
      // keep raw
    }
    if (looksLikeContextLengthError(message)) {
      return anthropicError(
        413,
        formatContextLengthMessage(body.model, message),
        'invalid_request_error',
      )
    }
    const classified = classifyProviderError({
      status: upstream.status,
      message,
    })
    return anthropicError(
      upstream.status,
      classified.userMessage || message,
    )
  }

  if (body.stream) {
    if (!upstream.body) {
      return anthropicError(502, 'Upstream returned empty stream')
    }
    // When tracing, tee the raw upstream stream and dump it to the log so we can
    // see the model's actual tool_calls / text without disturbing translation.
    let translateBody = upstream.body
    if (PROXY_DEBUG) {
      const [a, b] = upstream.body.tee()
      translateBody = a
      void (async () => {
        const reader = b.getReader()
        const decoder = new TextDecoder()
        let raw = ''
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            raw += decoder.decode(value, { stream: true })
          }
        } catch {
          // ignore
        }
        proxyDebugLog('RAW upstream stream', raw)
      })()
    }
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of openAiStreamToAnthropicEvents(
            translateBody,
            body.model,
          )) {
            controller.enqueue(encoder.encode(chunk))
          }
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : 'Stream translation failed'
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ type: 'error', error: { type: 'api_error', message: msg } })}\n\n`,
            ),
          )
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    })
  }

  let payload: Parameters<typeof openAiCompletionToAnthropic>[0]
  const rawBody = await upstream.text()
  if (!rawBody.trim()) {
    return anthropicError(
      502,
      `Upstream returned an empty response body (HTTP ${upstream.status}). Check provider URL, API key, and model id (${body.model}).`,
    )
  }
  try {
    payload = JSON.parse(rawBody) as Parameters<
      typeof openAiCompletionToAnthropic
    >[0]
  } catch {
    const preview = rawBody.trim().slice(0, 200)
    if (preview.startsWith('<')) {
      return anthropicError(
        502,
        'Upstream returned HTML instead of JSON — check base URL, proxy, or gateway configuration.',
      )
    }
    const msg =
      preview.length > 0
        ? `Upstream returned invalid JSON: ${preview}`
        : 'Upstream returned invalid JSON'
    return anthropicError(502, `OpenAI-compat upstream: ${msg}`)
  }
  if (!payload.choices?.length) {
    return anthropicError(
      502,
      `Upstream returned no choices for model ${body.model}. The model may be unavailable or misconfigured.`,
    )
  }
  proxyDebugLog('RAW upstream JSON', payload)
  const converted = openAiCompletionToAnthropic(payload, body.model)
  proxyDebugLog('CONVERTED →agent', converted)
  return new Response(JSON.stringify(converted), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** Start (or reuse) a local Graft-shaped proxy → OpenAI upstream. */
export function ensureOpenAiCompatProxySync(
  config: OpenAiCompatProxyConfig,
): string {
  if (activeServer && activeUrl && openAiCompatProxyConfigsEqual(activeConfig, config)) {
    return activeUrl
  }

  stopOpenAiCompatProxy()

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    // Slow OpenAI-compat upstreams (e.g. NVIDIA NIM) may take >10s before the first
    // token; Bun's default idleTimeout is too low. Cap at Bun's maximum (255s).
    idleTimeout: BUN_SERVE_MAX_IDLE_TIMEOUT_SEC,
    async fetch(req) {
      const url = new URL(req.url)
      if (req.method === 'GET' && url.pathname === '/v1/models') {
        return forwardModels(config)
      }
      if (req.method === 'POST' && url.pathname === '/v1/messages') {
        return handleMessages(req, config)
      }
      if (req.method === 'GET' && url.pathname === '/healthz') {
        return new Response('ok')
      }
      return new Response('Not Found', { status: 404 })
    },
  })

  activeServer = server
  activeConfig = config
  activeUrl = `http://127.0.0.1:${server.port}`
  process.env.GRAFT_OPENAI_COMPAT_PROXY = activeUrl
  return activeUrl
}

export function applyOpenAiCompatProxyEnv(
  config: OpenAiCompatProxyConfig,
): string {
  const proxyUrl = ensureOpenAiCompatProxySync(config)
  process.env.GRAFT_OPENAI_UPSTREAM_URL = config.upstreamBaseUrl
  process.env.ANTHROPIC_BASE_URL = proxyUrl
  process.env.ANTHROPIC_API_KEY = 'graft-local-proxy'
  delete process.env.ANTHROPIC_AUTH_TOKEN
  return proxyUrl
}
