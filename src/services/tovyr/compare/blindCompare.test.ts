import { describe, expect, test } from 'bun:test'
import {
  BLIND_SLOT_LABELS,
  parseCompareArgs,
} from './blindCompare.js'
import {
  classifyHardwareTier,
  detectHardwareProfile,
  recommendModelsForHardware,
} from '../cookbook/hardware.js'

describe('blindCompare', () => {
  test('defaults to blind mode', () => {
    const parsed = parseCompareArgs('which sorting algorithm is best?')
    expect(parsed.mode).toBe('blind')
    expect(parsed.prompt).toContain('sorting')
  })

  test('parses named vs syntax', () => {
    const parsed = parseCompareArgs('named gpt-4o vs llama-3')
    expect(parsed.mode).toBe('named')
    expect(parsed.modelA).toBe('gpt-4o')
    expect(parsed.modelB).toBe('llama-3')
  })

  test('blind slot labels are neutral', () => {
    expect(BLIND_SLOT_LABELS).toEqual(['Model A', 'Model B'])
  })
})

describe('cookbook hardware', () => {
  test('classifyHardwareTier buckets RAM', () => {
    expect(classifyHardwareTier(4)).toBe('small')
    expect(classifyHardwareTier(12)).toBe('medium')
    expect(classifyHardwareTier(24)).toBe('large')
    expect(classifyHardwareTier(64)).toBe('workstation')
  })

  test('detectHardwareProfile returns sane values', () => {
    const profile = detectHardwareProfile()
    expect(profile.ramGb).toBeGreaterThan(0)
    expect(profile.cpuCores).toBeGreaterThan(0)
    expect(profile.tier).toBeTruthy()
  })

  test('recommendModelsForHardware includes cloud and local hints', () => {
    const rec = recommendModelsForHardware({
      platform: 'test',
      cpuCores: 8,
      ramGb: 16,
      tier: 'medium',
      gpuName: null,
      vramGb: null,
    })
    expect(rec.cloud.length).toBeGreaterThan(0)
    expect(rec.local.length).toBeGreaterThan(0)
  })
})
