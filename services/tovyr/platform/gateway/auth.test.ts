import { describe, expect, test } from 'bun:test'
import { createGatewayToken, hashGatewayToken, verifyGatewayToken } from './auth.js'

describe('gateway bearer authentication', () => {
  test('round trips generated tokens and rejects altered tokens', () => {
    const token = createGatewayToken()
    const hash = hashGatewayToken(token)
    expect(verifyGatewayToken(token, hash)).toBe(true)
    expect(verifyGatewayToken(`${token}x`, hash)).toBe(false)
  })
})
