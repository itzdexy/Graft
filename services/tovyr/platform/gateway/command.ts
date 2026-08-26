import { loadGatewayConfig, saveGatewayConfig, type GatewayConfig } from './config.js'
import { createGatewayToken, hashGatewayToken } from './auth.js'
import { startGateway } from './server.js'
export async function serveGateway(options: { host?: string; port?: string } = {}): Promise<void> {
  const token = createGatewayToken()
  const config: GatewayConfig = { host: options.host || process.env.TOVYR_GATEWAY_HOST || '127.0.0.1', port: Number(options.port || process.env.TOVYR_GATEWAY_PORT || 4317), tokenHash: hashGatewayToken(token) }
  saveGatewayConfig(config)
  const running = await startGateway(config)
  console.log(`Tovyr gateway listening on http://${config.host}:${running.port}`)
  console.log(`Bearer token (shown once): ${token}`)
  await new Promise<void>(resolve => running.server.on('close', resolve))
}
export function gatewayStatus(): GatewayConfig | null { return loadGatewayConfig() }
