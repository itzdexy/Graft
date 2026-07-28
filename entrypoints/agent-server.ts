#!/usr/bin/env bun
/**
 * Headless Tovyr Agent HTTP server (OpenHands-style).
 * POST /v1/agent/run  { "prompt": "...", "sessionId": "optional" }
 * GET  /health
 */

import { startAgentServer } from '../agents/AgentServer.js'
import { runAgent } from '../agents/AgentSDK.js'
import { registerTovyrAgentSdk } from '../services/tovyr/agent/sdkRunner.js'
import { getCwd } from '../utils/cwd.js'

registerTovyrAgentSdk()

const host = process.env.TOVYR_AGENT_HOST ?? '0.0.0.0'
const port = Number(process.env.TOVYR_AGENT_PORT ?? process.argv[2] ?? 9477)
const token = process.env.TOVYR_AGENT_TOKEN

const handle = await startAgentServer({ host, port, token }, async ({ prompt, sessionId }) => {
  const cwd = getCwd()
  const run = await runAgent({ prompt, sessionId, cwd })
  const lastAssistant = [...run.messages]
    .reverse()
    .find(m => m.role === 'assistant')
  return {
    sessionId: run.sessionId,
    result: run.success
      ? (lastAssistant?.content ?? '(no response)')
      : (run.error ?? 'Agent run failed'),
  }
})

console.log(`Tovyr agent server listening at ${handle.url}`)
if (token) {
  console.log('Auth: Bearer token required (TOVYR_AGENT_TOKEN)')
}

const shutdown = async () => {
  await handle.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())