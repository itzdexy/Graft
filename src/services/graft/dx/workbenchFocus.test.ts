import { describe, expect, test } from 'bun:test'
import { resolveWorkbenchFocusFromCommand } from './workbenchFocus.js'

const filesCommand = {
  name: 'files',
  description: 'Open project files',
  type: 'local' as const,
  load: async () => ({ call: async () => ({ type: 'text' as const, value: '' }) }),
}

describe('resolveWorkbenchFocusFromCommand', () => {
  test('routes the enabled /files command to the real file focus surface', () => {
    expect(
      resolveWorkbenchFocusFromCommand('/files src', [filesCommand], () => true),
    ).toBe('file')
  })

  test('does not expose file focus for unavailable commands or ordinary prompts', () => {
    expect(
      resolveWorkbenchFocusFromCommand('/files', [filesCommand], () => false),
    ).toBe('none')
    expect(
      resolveWorkbenchFocusFromCommand('show the files', [filesCommand], () => true),
    ).toBe('none')
  })
})
