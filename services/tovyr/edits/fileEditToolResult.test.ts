import { describe, expect, test } from 'bun:test'
import {
  mapAiderFileEditToolResult,
  resolveFileEditDisplayPath,
} from './fileEditToolResult.js'

describe('fileEditToolResult', () => {
  test('resolveFileEditDisplayPath falls back safely', () => {
    expect(resolveFileEditDisplayPath({ filePath: 'a.ts' })).toBe('a.ts')
    expect(resolveFileEditDisplayPath({ file_path: 'b.ts' })).toBe('b.ts')
    expect(resolveFileEditDisplayPath({})).toBe('the file')
  })

  test('partial apply is_error with snake_case path', () => {
    const result = mapAiderFileEditToolResult(
      {
        file_path: 'src/foo.ts',
        aider_failures: ['Block 2: SEARCH text not found'],
      },
      'tool-1',
    )
    expect(result.is_error).toBe(true)
    expect(result.content).toContain('src/foo.ts')
    expect(result.content).toContain('did not match')
  })

  test('warnings on success path', () => {
    const result = mapAiderFileEditToolResult(
      {
        filePath: 'x.ts',
        aider_warnings: ['ambiguous match'],
      },
      'tool-2',
    )
    expect(result.is_error).toBeUndefined()
    expect(result.content).toContain('Warnings: ambiguous match')
  })

  test('replaceAll success message', () => {
    const result = mapAiderFileEditToolResult(
      { filePath: 'z.ts', replaceAll: true },
      'tool-3',
    )
    expect(result.content).toContain('All occurrences were successfully replaced')
  })
})