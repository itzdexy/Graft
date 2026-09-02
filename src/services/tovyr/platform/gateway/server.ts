import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { streamInference } from '../inference.js'
import { verifyGatewayToken } from './auth.js'
import type { GatewayConfig } from './config.js'
import { listConnectedPlatformModels } from '../providerRegistry.js'
import { toCodexModelsResponse } from './codexModels.js'
import { decodeOpenAiChatRequest, encodeOpenAiChatJson, encodeOpenAiChatStream } from './protocols/openaiChat.js'
import { decodeAnthropicMessagesRequest, encodeAnthropicMessagesJson, encodeAnthropicMessagesStream } from './protocols/anthropicMessages.js'
import { decodeOpenAiResponsesRequest, encodeOpenAiResponsesJson, encodeOpenAiResponsesStream } from './protocols/openaiResponses.js'
import type { NormalizedProviderStreamEvent } from '../types.js'

export function gatewayRequiresAuth(host: string, requireLoopbackAuth = process.env.TOVYR_GATEWAY_REQUIRE_AUTH === '1'): boolean {
  const loopback = host === '127.0.0.1' || host === 'localhost' || host === '::1'
  return !loopback || requireLoopbackAuth
}

async function collectEvents(stream: AsyncIterable<NormalizedProviderStreamEvent>): Promise<NormalizedProviderStreamEvent[]> {
  const events: NormalizedProviderStreamEvent[] = []
  for await (const event of stream) events.push(event)
  return events
}

async function pipeReadable(res: import('node:http').ServerResponse, stream: ReadableStream<Uint8Array>): Promise<void> {
  const reader = stream.getReader()
  for (;;) {
    const next = await reader.read()
    if (next.done) return
    res.write(next.value)
  }
}

export function startGateway(config: GatewayConfig): Promise<{ server: Server; port: number }> {
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname
    const isOllamaCompat = pathname === '/api/tags' || pathname === '/api/chat' || pathname === '/api/generate'
    const suppliedToken = String(req.headers.authorization || req.headers['x-api-key'] || '').replace(/^Bearer\s+/i, '')
    if (gatewayRequiresAuth(config.host)) {
      if (!verifyGatewayToken(suppliedToken, config.tokenHash)) { res.writeHead(401).end('Unauthorized'); return }
    }
    if (req.method === 'GET' && pathname === '/api/tags') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ models: listConnectedPlatformModels().map(model => ({ name: model.id, model: model.id, modified_at: new Date().toISOString(), size: 0, digest: 'tovyr' })) }))
      return
    }
    if (req.method === 'GET' && pathname === '/v1/models') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(toCodexModelsResponse(listConnectedPlatformModels())))
      return
    }
    if (req.method !== 'POST' || (!isOllamaCompat && !['/v1/chat/completions', '/v1/messages', '/v1/responses'].includes(pathname))) { res.writeHead(404).end(); return }
    let raw = ''; for await (const chunk of req) raw += chunk
    try {
      const body = JSON.parse(raw)
      const ollama = isOllamaCompat
      const responses = pathname === '/v1/responses'
      const anthropic = pathname === '/v1/messages'
      const input = ollama && pathname === '/api/generate' && typeof body.prompt === 'string'
        ? { ...body, messages: [{ role: 'user', content: body.prompt }] }
        : body
      // Ollama clients historically stream by default; the OpenAI, Anthropic,
      // and Responses protocols stream only when explicitly requested.
      if (ollama && input.stream === undefined) input.stream = true
      const request = anthropic
        ? decodeAnthropicMessagesRequest(input)
        : responses
          ? decodeOpenAiResponsesRequest(input)
          : decodeOpenAiChatRequest(input)
      const abort = new AbortController()
      req.once('aborted', () => abort.abort())
      const sourceStream = streamInference(request, abort.signal)
      const stream = (async function* () {
        for await (const event of sourceStream) {
          yield event
        }
      })()

      if (!request.stream) {
        const events = await collectEvents(stream)
        const failure = events.find((event): event is Extract<NormalizedProviderStreamEvent, { type: 'error' }> => event.type === 'error')
        if (failure) {
          const payload = ollama
            ? { error: failure.message }
            : anthropic
              ? { type: 'error', error: { type: failure.kind, message: failure.message } }
              : { error: { type: failure.kind, message: failure.message } }
          res.writeHead(502, { 'content-type': 'application/json', 'x-request-id': randomUUID() }).end(JSON.stringify(payload))
          return
        }
        if (ollama) {
          const text = events.filter(event => event.type === 'text_delta').map(event => event.text).join('')
          res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': randomUUID() }).end(JSON.stringify({ model: request.model, response: text, done: true }))
        } else {
          const payload = anthropic ? encodeAnthropicMessagesJson(request.model, events) : responses ? encodeOpenAiResponsesJson(request.model, events) : encodeOpenAiChatJson(request.model, events)
          res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': randomUUID() }).end(JSON.stringify(payload))
        }
        return
      }

      res.writeHead(200, { 'content-type': ollama ? 'application/x-ndjson' : 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-request-id': randomUUID() })
      if (ollama) {
        for await (const event of stream) {
          const payload = event.type === 'text_delta' ? { model: request.model, message: { role: 'assistant', content: event.text }, done: false } : event.type === 'complete' ? { model: request.model, done: true, done_reason: event.stopReason || 'stop' } : event.type === 'error' ? { model: request.model, error: event.message, done: true } : { model: request.model, done: false }
          res.write(`${JSON.stringify(payload)}\n`)
        }
        res.end()
      } else {
        const encoded = anthropic ? encodeAnthropicMessagesStream(request.model, stream) : responses ? encodeOpenAiResponsesStream(request.model, stream) : encodeOpenAiChatStream(request.model, stream)
        await pipeReadable(res, encoded)
        res.end()
      }
    } catch (error) { res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { message: error instanceof Error ? error.message : 'Invalid request' } })) }
  })
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, () => { const address = server.address(); resolve({ server, port: typeof address === 'object' && address ? address.port : config.port }) }) })
}
