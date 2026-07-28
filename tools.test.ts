import { afterEach, describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from './Tool.js'
import { getTools } from './tools.js'
import { FILE_WRITE_TOOL_NAME } from './tools/FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from './tools/GlobTool/prompt.js'
import { WEB_SEARCH_TOOL_NAME } from './tools/WebSearchTool/prompt.js'

describe('getTools simple mode', () => {
  const prevSimple = process.env.TOVYR_CODE_SIMPLE

  afterEach(() => {
    if (prevSimple === undefined) delete process.env.TOVYR_CODE_SIMPLE
    else process.env.TOVYR_CODE_SIMPLE = prevSimple
  })

  test('bare mode exposes expanded built-in tools, not just Bash/Read/Edit', () => {
    process.env.TOVYR_CODE_SIMPLE = '1'
    const names = new Set(
      getTools(getEmptyToolPermissionContext()).map(tool => tool.name),
    )
    expect(names.has('Bash')).toBe(true)
    expect(names.has('Read')).toBe(true)
    expect(names.has('Edit')).toBe(true)
    expect(names.has(FILE_WRITE_TOOL_NAME)).toBe(true)
    expect(names.has(WEB_SEARCH_TOOL_NAME)).toBe(true)
    expect(names.has('WebFetch')).toBe(true)
    expect(names.has('Agent')).toBe(true)
    expect(names.has('Skill')).toBe(true)
    // Glob omitted when embedded search aliases find/grep in the shell
    if (names.has(GLOB_TOOL_NAME)) {
      expect(names.has('Grep')).toBe(true)
    }
  })
})
