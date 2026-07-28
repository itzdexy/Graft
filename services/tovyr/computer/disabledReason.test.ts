import { describe, expect, test } from 'bun:test'
import {
  getChicagoDisabledReason,
  hasComputerUseSubscription,
  isChicagoEnabledFromInput,
  isAntMonorepoComputerUseBlocked,
} from './disabledReason.js'

const enabledInput = {
  userType: undefined as string | undefined,
  monorepoRootDir: undefined as string | undefined,
  allowAntComputerUse: false,
  subscriptionTier: 'max' as string | undefined,
  featureEnabled: true,
}

describe('disabledReason', () => {
  test('subscription gate', () => {
    expect(hasComputerUseSubscription('ant', undefined)).toBe(true)
    expect(hasComputerUseSubscription(undefined, 'pro')).toBe(true)
    expect(hasComputerUseSubscription(undefined, 'free')).toBe(false)
  })

  test('ant monorepo block', () => {
    expect(
      isAntMonorepoComputerUseBlocked({
        ...enabledInput,
        userType: 'ant',
        monorepoRootDir: '/repo',
        allowAntComputerUse: false,
      }),
    ).toBe(true)
    expect(
      isAntMonorepoComputerUseBlocked({
        ...enabledInput,
        userType: 'ant',
        monorepoRootDir: '/repo',
        allowAntComputerUse: true,
      }),
    ).toBe(false)
  })

  test('disabled reasons are specific', () => {
    expect(
      getChicagoDisabledReason({
        ...enabledInput,
        subscriptionTier: 'free',
      }),
    ).toContain('Max or Pro')
    expect(
      getChicagoDisabledReason({
        ...enabledInput,
        featureEnabled: false,
      }),
    ).toContain('not enabled')
  })

  test('enabled when all gates pass', () => {
    expect(isChicagoEnabledFromInput(enabledInput)).toBe(true)
    expect(getChicagoDisabledReason(enabledInput)).toBeUndefined()
  })
})