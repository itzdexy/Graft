/** HTTP bridge for remote Tovyr agent control. */
import { createServer, type Server } from 'node:http'

export interface AgentServerConfig {
  host: string
  port: number
  token?: string
}

export interface AgentServerHandle {
  url: string
  close: () => Promise<void>
}

type TaskHandler = (body: { prompt: string; sessionId?: string }) => Promise<{
  result: string
  sessionId: string
}>

let server: Server | null = null

export async function startAgentServer(
  config: AgentServerConfig,
  handler: TaskHandler,
): Promise<AgentServerHandle> {
  if (server) throw new Error('Agent server already running')
  const { host, port, token } = config

  server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    if (req.method !== 'POST' || req.url !== '/v1/agent/run') {
      res.writeHead(404)
      res.end()
      return
    }
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401)
      res.end(JSON.stringify({ error: 'unauthorized' }))
      return
    }

    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    let body: { prompt?: string; sessionId?: string }
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'invalid json' }))
      return
    }
    if (!body.prompt) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'prompt required' }))
      return
    }

    try {
      const result = await handler({ prompt: body.prompt, sessionId: body.sessionId })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'agent error',
      }))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server!.listen(port, host, resolve)
    server!.on('error', reject)
  })
  return {
    url: `http://${host}:${port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server?.close(error => (error ? reject(error) : resolve()))
      })
      server = null
    },
  }
}

export function isAgentServerRunning(): boolean {
  return server !== null
}
