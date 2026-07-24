import { describe, expect, test } from 'bun:test'
import {
  normalizeToolName,
  normalizeToolArguments,
  parseLooseToolArguments,
} from './toolNormalization.js'
import { FILE_EDIT_TOOL_NAME } from '../../../tools/FileEditTool/constants.js'

describe('normalizeToolName', () => {
  test('maps common write/edit/read/bash aliases to canonical names', () => {
    expect(normalizeToolName('write_file')).toBe('Write')
    expect(normalizeToolName('createFile')).toBe('Write')
    expect(normalizeToolName('str_replace_editor')).toBe('Edit')
    expect(normalizeToolName('apply_patch')).toBe('Edit')
    expect(normalizeToolName('read_file')).toBe('Read')
    expect(normalizeToolName('shell')).toBe('Bash')
    expect(normalizeToolName('run_command')).toBe('Bash')
    expect(normalizeToolName('ripgrep')).toBe('Grep')
  })

  test('is idempotent on canonical names', () => {
    for (const name of ['Write', 'Edit', 'Read', 'Bash', 'Grep', 'Glob']) {
      expect(normalizeToolName(name)).toBe(name)
    }
  })

  test('leaves MCP and unknown tool names untouched', () => {
    expect(normalizeToolName('mcp__github__create_issue')).toBe(
      'mcp__github__create_issue',
    )
    expect(normalizeToolName('SomeCustomTool')).toBe('SomeCustomTool')
  })
})

describe('parseLooseToolArguments', () => {
  test('parses well-formed JSON', () => {
    expect(parseLooseToolArguments('{"a":1}')).toEqual({ a: 1 })
  })

  test('returns {} for empty or nullish input', () => {
    expect(parseLooseToolArguments('')).toEqual({})
    expect(parseLooseToolArguments(undefined)).toEqual({})
    expect(parseLooseToolArguments(null)).toEqual({})
  })

  test('escapes unescaped newlines inside string values (file content)', () => {
    const raw = '{"file_path":"index.html","content":"<html>\n<body>hi</body>\n</html>"}'
    const parsed = parseLooseToolArguments(raw)
    expect(parsed.file_path).toBe('index.html')
    expect(parsed.content).toBe('<html>\n<body>hi</body>\n</html>')
  })

  test('strips trailing commas', () => {
    expect(parseLooseToolArguments('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 })
  })

  test('unwraps a markdown code fence', () => {
    expect(parseLooseToolArguments('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  test('slices JSON out of surrounding prose', () => {
    expect(
      parseLooseToolArguments('Sure, here are the args: {"a":1} hope that helps'),
    ).toEqual({ a: 1 })
  })

  test('normalizes smart quotes', () => {
    expect(parseLooseToolArguments('{“a”:1}')).toEqual({ a: 1 })
  })

  test('normalizeToolArguments maps Edit aliases', () => {
    expect(
      normalizeToolArguments('str_replace_editor', {
        path: 'index.html',
        content: '<html></html>',
      }),
    ).toMatchObject({
      file_path: 'index.html',
      new_string: '<html></html>',
    })
  })

  test('normalizeToolArguments coerces object new_string to string', () => {
    const out = normalizeToolArguments(FILE_EDIT_TOOL_NAME, {
      file_path: 'index.html',
      old_string: 'x',
      new_string: { body: 'benchmark' },
    })
    expect(typeof out.new_string).toBe('string')
    expect(out.new_string).toContain('benchmark')
  })
})
