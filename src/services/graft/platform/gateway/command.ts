import { loadGatewayConfig, saveGatewayConfig, type GatewayConfig } from './config.js'
import { createGatewayToken, hashGatewayToken } from './auth.js'
import { startGateway } from './server.js'

export const DEFAULT_GATEWAY_PORT = 11434

export function resolveGatewayPort(options: { port?: string } = {}): number {
  return Number(options.port || process.env.GRAFT_GATEWAY_PORT || DEFAULT_GATEWAY_PORT)
}

export async function serveGateway(options: { host?: string; port?: string } = {}): Promise<void> {
  // App launchers can provision an ephemeral token without persisting it.
  // Manual graft serve still creates a fresh token and prints it once.
  const token = process.env.GRAFT_GATEWAY_TOKEN?.trim() || createGatewayToken()
  const config: GatewayConfig = { host: options.host || process.env.GRAFT_GATEWAY_HOST || '127.0.0.1', port: resolveGatewayPort(options), tokenHash: hashGatewayToken(token) }
  saveGatewayConfig(config)
  const running = await startGateway(config)
  console.log(`Graft gateway listening on http://${config.host}:${running.port}`)
  console.log(`Bearer token (shown once): ${token}`)
  await new Promise<void>(resolve => running.server.on('close', resolve))
}
export function gatewayStatus(): GatewayConfig | null { return loadGatewayConfig() }
