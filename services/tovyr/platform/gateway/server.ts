import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { assertNormalizedRequest } from '../types.js'
import { streamInference } from '../inference.js'
import { verifyGatewayToken } from './auth.js'
import type { GatewayConfig } from './config.js'
import { listPlatformModels } from '../providerRegistry.js'
export function startGateway(config: GatewayConfig): Promise<{ server: Server; port: number }> {
  const server = createServer(async (req, res) => {
    const suppliedToken = String(req.headers.authorization || req.headers['x-api-key'] || '').replace(/^Bearer\s+/i, '')
    if (!verifyGatewayToken(suppliedToken, config.tokenHash)) { res.writeHead(401).end('Unauthorized'); return }
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ object: 'list', data: listPlatformModels().map(model => ({ id: model.id, object: 'model', owned_by: model.id.split('::')[0] })) }))
      return
    }
    if (req.method !== 'POST' || !['/v1/chat/completions', '/v1/messages', '/v1/responses'].includes(req.url || '')) { res.writeHead(404).end(); return }
    let raw = ''; for await (const chunk of req) raw += chunk
    try {
      const body = JSON.parse(raw)
      const sourceMessages = Array.isArray(body.messages) ? body.messages : (Array.isArray(body.input) ? body.input : [])
      const messages = sourceMessages.map((message: any) => ({ role: message.role || 'user', content: typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : (message.content || []).map((part: any) => part.type === 'text' ? part : part.type === 'tool_use' ? { type: 'tool_call', id: part.id, name: part.name, arguments: part.input } : part.type === 'tool_result' ? { type: 'tool_result', toolCallId: part.tool_use_id, content: typeof part.content === 'string' ? part.content : JSON.stringify(part.content) } : part) }))
      const request = assertNormalizedRequest({ ...body, model: body.model || body.input?.model, messages, stream: true })
      const stream = streamInference(request, req.destroyed ? AbortSignal.abort() : new AbortController().signal)
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-request-id': randomUUID() })
      for await (const event of stream) {
        const payload = event.type === 'text_delta' ? { choices: [{ index: 0, delta: { content: event.text }, finish_reason: null }] } : event.type === 'complete' ? { choices: [{ index: 0, delta: {}, finish_reason: event.stopReason || 'stop' }] } : event
        res.write(`data: ${JSON.stringify(payload)}\n\n`)
      }
      res.write('data: [DONE]\n\n'); res.end()
    } catch (error) { res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { message: error instanceof Error ? error.message : 'Invalid request' } })) }
  })
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, () => { const address = server.address(); resolve({ server, port: typeof address === 'object' && address ? address.port : config.port }) }) })
}
