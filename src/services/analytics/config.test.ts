import { afterEach, describe, expect, test } from 'bun:test'
import { isAnalyticsDisabled } from './config.js'

const prevRuntime = process.env.TOVYR_SRC
const prevRoot = process.env.TOVYR_PACKAGE_ROOT
const prevNodeEnv = process.env.NODE_ENV

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

afterEach(() => {
  restore('TOVYR_SRC', prevRuntime)
  restore('TOVYR_PACKAGE_ROOT', prevRoot)
  restore('NODE_ENV', prevNodeEnv)
})

describe('isAnalyticsDisabled', () => {
  test('Tovyr never emits telemetry, whatever else is set', () => {
    // Upstream's sink posts to /api/event_logging/batch and Datadog. Tovyr
    // repoints ANTHROPIC_BASE_URL at the user's own provider, so those events
    // were being sent outward on the user's credentials.
    process.env.TOVYR_SRC = '1'
    delete process.env.NODE_ENV
    expect(isAnalyticsDisabled()).toBe(true)
  })

  test('still disabled in tests outside the Tovyr runtime', () => {
    delete process.env.TOVYR_SRC
    delete process.env.TOVYR_PACKAGE_ROOT
    process.env.NODE_ENV = 'test'
    expect(isAnalyticsDisabled()).toBe(true)
  })
})
