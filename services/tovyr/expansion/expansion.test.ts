import { describe, expect, test } from 'bun:test'
import {
  formatExpansionStatusTable,
  getExpansionFeatureStatuses,
} from './index.js'

describe('live expansion capabilities', () => {
  test('lists only shipped source capabilities', () => {
    const ids = getExpansionFeatureStatuses().map(feature => feature.id)
    expect(ids).toEqual([
      'code-mode',
      'agent-sdk',
      'agent-server',
      'multilang-mcp',
      'sequential-thinking',
      'memory-graph',
    ])
  })

  test('reports code mode from the active permission mode', () => {
    const codeMode = getExpansionFeatureStatuses({ permissionMode: 'acceptEdits' })
    expect(codeMode.find(feature => feature.id === 'code-mode')?.status).toBe('active')
    expect(formatExpansionStatusTable()).toContain('Tovyr extension capabilities')
  })
})
