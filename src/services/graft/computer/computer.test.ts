import { describe, expect, test } from 'bun:test'
import {
  graftComputerHostPath,
  getGraftComputerStatus,
  readGraftComputerUseConfig,
} from './state.js'

describe('Graft Windows computer-use beta', () => {
  test('is disabled by default or reflects explicit Graft-only config', () => {
    const config = readGraftComputerUseConfig()
    expect(typeof config.enabled).toBe('boolean')
    expect(Array.isArray(config.allowedApps)).toBe(true)
  })

  test('host lives only under the Graft runtime directory', () => {
    const path = graftComputerHostPath().toLowerCase()
    expect(path).toContain('.graft')
    expect(path).toContain('runtime')
    expect(path).toContain('graft-computer-host')
    expect(path).not.toContain('.claude')
  })

  test('never reports ready without platform, feature, and host', () => {
    const status = getGraftComputerStatus()
    expect(status.ready).toBe(
      status.supported && status.enabled && status.hostInstalled,
    )
  })
})
