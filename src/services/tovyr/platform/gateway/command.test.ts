import { describe, expect, test } from 'bun:test'
import { DEFAULT_GATEWAY_PORT, resolveGatewayPort } from './command.js'

describe('gateway defaults', () => {
  test('uses the Ollama-compatible port by default and honors overrides', () => {
    const previous = process.env.TOVYR_GATEWAY_PORT
    try {
      delete process.env.TOVYR_GATEWAY_PORT
      expect(DEFAULT_GATEWAY_PORT).toBe(11434)
      expect(resolveGatewayPort({})).toBe(11434)
      expect(resolveGatewayPort({ port: '4317' })).toBe(4317)
    } finally {
      if (previous === undefined) delete process.env.TOVYR_GATEWAY_PORT
      else process.env.TOVYR_GATEWAY_PORT = previous
    }
  })
})
