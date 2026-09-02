import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTovyrHome } from '../../../../../scripts/tovyr-home.js'
export type GatewayConfig = { host: string; port: number; tokenHash: string }
const path = () => join(getTovyrHome(), '.tovyr', 'gateway.json')
export function loadGatewayConfig(): GatewayConfig | null { try { return JSON.parse(readFileSync(path(), 'utf8')) } catch { return null } }
export function saveGatewayConfig(config: GatewayConfig): void { const file = path(); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 }) }
