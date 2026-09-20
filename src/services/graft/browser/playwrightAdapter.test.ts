import { describe, expect, test } from 'bun:test'
import { automationRisk } from '../providers/automation.js'
import {
  PLAYWRIGHT_MCP_PACKAGE,
  buildPlaywrightMcpConfig,
  validatePlaywrightCdpEndpoint,
} from './playwright.js'
import { playwrightToolForAction } from './playwrightAdapter.js'
import { validateBrowserAutomationUrl } from './urlSafety.js'

describe('Playwright browser adapter', () => {
  test('pins the MCP runtime and isolates its profile under Graft', () => {
    const config = buildPlaywrightMcpConfig()
    expect(config.args).toContain(PLAYWRIGHT_MCP_PACKAGE)
    expect(config.args).toContain('--user-data-dir')
    expect(config.args.join(' ')).toContain('.graft')
    expect(config.args).not.toContain('--extension')
  })

  test('uses explicit opt-in for a running Chrome session', () => {
    const config = buildPlaywrightMcpConfig({
      kind: 'cdp',
      endpoint: 'chrome',
    })
    expect(config.args).toContain('--cdp-endpoint')
    expect(config.args).toContain('chrome')
    expect(config.args).not.toContain('--user-data-dir')
  })

  test('rejects credential-bearing CDP URLs before persistence', () => {
    expect(validatePlaywrightCdpEndpoint('https://user:secret@example.test').ok).toBe(false)
    expect(validatePlaywrightCdpEndpoint('not a url').ok).toBe(true)
  })

  test('maps snapshots and deterministic ref clicks', () => {
    expect(
      playwrightToolForAction({
        type: 'observe',
        target: { kind: 'browser' },
      }).tool,
    ).toBe('browser_snapshot')
    expect(
      playwrightToolForAction({
        type: 'click',
        target: { kind: 'browser' },
        ref: 'e12',
      }),
    ).toEqual({
      tool: 'browser_click',
      input: { ref: 'e12', element: 'e12' },
    })
  })

  test('blocks private-network navigation by default', () => {
    expect(validateBrowserAutomationUrl('http://127.0.0.1:3000').ok).toBe(
      false,
    )
    expect(
      validateBrowserAutomationUrl('http://127.0.0.1:3000', {
        allowPrivateNetwork: true,
      }).ok,
    ).toBe(true)
  })

  test('requires confirmation for actions and reconfirmation for high risk', () => {
    expect(
      automationRisk({
        type: 'observe',
        target: { kind: 'browser' },
      }),
    ).toBe('passive')
    expect(
      automationRisk({
        type: 'type',
        target: { kind: 'browser' },
        text: 'hello',
      }),
    ).toBe('sensitive')
    expect(
      automationRisk({
        type: 'purchase',
        target: { kind: 'browser' },
        description: 'Buy item',
      }),
    ).toBe('destructive')
  })
})
