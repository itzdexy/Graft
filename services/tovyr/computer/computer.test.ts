import { describe, expect, test } from 'bun:test'
import {
  tovyrComputerHostPath,
  getTovyrComputerStatus,
  readTovyrComputerUseConfig,
} from './state.js'

describe('Tovyr Windows computer-use beta', () => {
  test('is disabled by default or reflects explicit Tovyr-only config', () => {
    const config = readTovyrComputerUseConfig()
    expect(typeof config.enabled).toBe('boolean')
    expect(Array.isArray(config.allowedApps)).toBe(true)
  })

  test('host lives only under the Tovyr runtime directory', () => {
    const path = tovyrComputerHostPath().toLowerCase()
    expect(path).toContain('.tovyr')
    expect(path).toContain('runtime')
    expect(path).toContain('tovyr-computer-host')
    expect(path).not.toContain('.claude')
  })

  test('never reports ready without platform, feature, and host', () => {
    const status = getTovyrComputerStatus()
    expect(status.ready).toBe(
      status.supported && status.enabled && status.hostInstalled,
    )
  })
})
