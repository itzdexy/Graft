import { describe, expect, test } from 'bun:test'
import {
  escalateWaitStatusLabel,
  formatStillWaitingHint,
  formatStreamIdleTimeoutMessage,
  FIRST_TOKEN_ESCALATE_MS,
  FIRST_TOKEN_HELP_MS,
} from './waitStateCopy.js'

describe('waitStateCopy', () => {
  test('formatStillWaitingHint includes model and esc affordances', () => {
    const hint = formatStillWaitingHint()
    expect(hint).toContain('/model')
    expect(hint).toContain('Esc')
  })

  test('escalateWaitStatusLabel waits until threshold', () => {
    expect(
      escalateWaitStatusLabel('requesting', FIRST_TOKEN_ESCALATE_MS - 1, 'Connecting to model'),
    ).toBeNull()
    expect(
      escalateWaitStatusLabel('requesting', FIRST_TOKEN_ESCALATE_MS, 'Connecting to model'),
    ).toBe('Provider is slow · 10s · Esc to stop')
    expect(
      escalateWaitStatusLabel('requesting', FIRST_TOKEN_HELP_MS, 'Connecting to model'),
    ).toContain('/model')
  })

  test('escalateWaitStatusLabel names degraded and offline providers', () => {
    expect(
      escalateWaitStatusLabel(
        'responding',
        FIRST_TOKEN_ESCALATE_MS,
        'Waiting for first token',
        'degraded',
      ),
    ).toContain('Provider degraded')
    expect(
      escalateWaitStatusLabel(
        'responding',
        FIRST_TOKEN_ESCALATE_MS,
        'Waiting for first token',
        'offline',
      ),
    ).toContain('Provider offline')
  })

  test('escalateWaitStatusLabel skips generating responses', () => {
    expect(
      escalateWaitStatusLabel('responding', 12_000, 'Generating response'),
    ).toBeNull()
  })

  test('formatStreamIdleTimeoutMessage pairs with still-waiting copy', () => {
    const msg = formatStreamIdleTimeoutMessage(90)
    expect(msg).toContain('90s')
    expect(msg).toContain('/model')
    expect(msg).toContain('Esc')
  })
})
