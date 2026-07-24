import { describe, expect, test } from 'bun:test'
import {
  coerceEditString,
  normalizeEditToolArguments,
  normalizeEditToolInputShape,
} from './normalizeEditInput.js'
import { FileEditTool } from '../../../tools/FileEditTool/FileEditTool.js'

describe('normalizeEditInput', () => {
  test('coerceEditString stringifies objects', () => {
    expect(coerceEditString({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(coerceEditString('hello')).toBe('hello')
  })

  test('coerceEditString joins string arrays with newlines', () => {
    expect(coerceEditString(['line1', 'line2'])).toBe('line1\nline2')
  })

  test('maps path and content aliases onto Edit fields', () => {
    expect(
      normalizeEditToolArguments({
        path: 'style.css',
        content: 'body { color: red; }',
      }),
    ).toMatchObject({
      file_path: 'style.css',
      new_string: 'body { color: red; }',
    })
  })

  test('maps original/updated aliases', () => {
    expect(
      normalizeEditToolArguments({
        file_path: 'script.js',
        original: 'old code',
        updated: 'new code',
      }),
    ).toMatchObject({
      old_string: 'old code',
      new_string: 'new code',
    })
  })

  test('maps edits array with search/replace', () => {
    expect(
      normalizeEditToolArguments({
        file_path: 'index.html',
        edits: [{ search: '<old>', replace: '<new>' }],
      }),
    ).toMatchObject({
      file_path: 'index.html',
      old_string: '<old>',
      new_string: '<new>',
    })
  })

  test('Zod preprocess accepts coerced Edit input', () => {
    const parsed = FileEditTool.inputSchema.safeParse({
      path: 'index.html',
      content: '<!DOCTYPE html><html></html>',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.file_path).toBe('index.html')
      expect(parsed.data.new_string).toContain('<!DOCTYPE html>')
      expect(parsed.data.old_string).toBe('')
    }
  })

  test('normalizeEditToolInputShape strips unknown keys', () => {
    expect(
      normalizeEditToolInputShape({
        path: 'a.html',
        content: 'hi',
        extra: true,
      }),
    ).toEqual({
      file_path: 'a.html',
      old_string: '',
      new_string: 'hi',
    })
  })
})
