import { describe, expect, test } from 'bun:test'
import { gatewayRequiresAuth } from './server.js'

describe('gateway authentication boundary', () => {
  test('allows local loopback integrations without a shared token', () => {
    expect(gatewayRequiresAuth('127.0.0.1', false)).toBe(false)
    expect(gatewayRequiresAuth('localhost', false)).toBe(false)
    expect(gatewayRequiresAuth('::1', false)).toBe(false)
  })

  test('keeps authentication for non-loopback and explicitly protected hosts', () => {
    expect(gatewayRequiresAuth('0.0.0.0', false)).toBe(true)
    expect(gatewayRequiresAuth('192.168.1.10', false)).toBe(true)
    expect(gatewayRequiresAuth('127.0.0.1', true)).toBe(true)
  })
})
