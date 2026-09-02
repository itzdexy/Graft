import { describe, expect, test } from 'bun:test'
import {
  classifyCommandRisk,
  commandRiskColor,
  commandRiskGlyph,
} from './commandRisk.js'

describe('classifyCommandRisk', () => {
  test('data-destroying commands are high risk', () => {
    expect(classifyCommandRisk('rm -rf build').level).toBe('high')
    expect(classifyCommandRisk('git push --force').level).toBe('high')
    expect(classifyCommandRisk('DROP DATABASE app').level).toBe('high')
  })

  test('high risk carries the reason for the glyph', () => {
    expect(classifyCommandRisk('rm -rf build').label).toContain('delete')
  })

  test('consequential-but-recoverable commands are medium', () => {
    expect(classifyCommandRisk('git push origin main').level).toBe('medium')
    expect(classifyCommandRisk('sudo apt install nginx').level).toBe('medium')
    expect(classifyCommandRisk('npm publish').level).toBe('medium')
    expect(classifyCommandRisk('brew install node').level).toBe('medium')
  })

  test('everyday commands carry no risk styling', () => {
    for (const command of [
      'ls -la',
      'npm run build',
      'git status',
      'mkdir -p src',
      'cargo test',
    ]) {
      expect(classifyCommandRisk(command)).toEqual({ level: 'none', label: null })
    }
  })

  test('destructive outranks merely powerful', () => {
    // A force push is both outward and destructive; it must read as the worse
    // of the two.
    expect(classifyCommandRisk('git push --force origin main').level).toBe('high')
  })
})

describe('commandRiskGlyph', () => {
  test('high risk gets a warning triangle', () => {
    expect(commandRiskGlyph('high')).toBe('⚠')
  })

  test('medium risk gets a lighter mark', () => {
    expect(commandRiskGlyph('medium')).toBe('!')
  })

  test('ordinary rows get nothing', () => {
    expect(commandRiskGlyph('none')).toBe('')
    expect(commandRiskGlyph('low')).toBe('')
  })
})

describe('commandRiskColor', () => {
  test('high is error, medium is warning', () => {
    expect(commandRiskColor('high')).toBe('error')
    expect(commandRiskColor('medium')).toBe('warning')
  })

  test('ordinary rows keep their status colour', () => {
    expect(commandRiskColor('none')).toBeNull()
  })
})
