import { describe, expect, test } from 'bun:test'
import {
  buildToolPresentation,
  classifyTool,
  projectToolExpansionChrome,
  shouldExpandTool,
  summarizeToolGroup,
  toolCategoryGlyph,
} from './toolPresentation.js'

describe('Tovyr tool presentation', () => {
  test('classifies common tool families', () => {
    expect(classifyTool('Read')).toBe('read')
    expect(classifyTool('Grep')).toBe('search')
    expect(classifyTool('Bash')).toBe('shell')
    expect(classifyTool('Edit')).toBe('edit')
    expect(classifyTool('WebFetch')).toBe('web')
    expect(classifyTool('mcp__github__search')).toBe('search')
    expect(classifyTool('Agent')).toBe('agent')
  })

  test('shows actionable failures in smart mode', () => {
    const failed = buildToolPresentation({
      toolName: 'Bash',
      input: { command: 'npm test' },
      status: 'failed',
      resultSummary: '2 tests failed',
      exitCode: 1,
    })
    const routine = buildToolPresentation({
      toolName: 'Read',
      input: { file_path: 'src/index.ts' },
      status: 'succeeded',
      resultSummary: '42 lines',
    })
    expect(shouldExpandTool(failed, 'smart')).toBe(true)
    expect(shouldExpandTool(routine, 'smart')).toBe(false)
    expect(shouldExpandTool(routine, 'expanded')).toBe(true)
  })

  test('summarizes groups by activity', () => {
    const tools = [
      buildToolPresentation({ toolName: 'Read', status: 'succeeded' }),
      buildToolPresentation({ toolName: 'Read', status: 'succeeded' }),
      buildToolPresentation({ toolName: 'Grep', status: 'succeeded' }),
    ]
    expect(summarizeToolGroup(tools)).toBe('Read 2 files · Searched 1 patterns')
  })

  test('keeps expanded tools in Tovyr chrome instead of the legacy renderer', () => {
    expect(projectToolExpansionChrome(true, true)).toEqual({
      renderer: 'tovyr',
      detailMode: 'expanded',
      rowBackground: undefined,
      rowPaddingBottom: undefined,
    })
    expect(projectToolExpansionChrome(true, false)).toMatchObject({
      renderer: 'tovyr',
      detailMode: 'compact',
    })
    expect(projectToolExpansionChrome(false, true)).toMatchObject({
      renderer: 'legacy',
      rowBackground: 'userMessageBackgroundHover',
    })
  })

  test('uses fixed-width, non-emoji category glyphs', () => {
    const glyphs = [
      toolCategoryGlyph('read'),
      toolCategoryGlyph('search'),
      toolCategoryGlyph('shell'),
      toolCategoryGlyph('edit'),
      toolCategoryGlyph('web'),
      toolCategoryGlyph('mcp'),
      toolCategoryGlyph('agent'),
      toolCategoryGlyph('other'),
    ]
    expect(glyphs).toEqual(['▫', '⌕', '›', '✎', '◍', '◈', '◆', '·'])
    expect(glyphs.every(glyph => glyph.length === 1)).toBe(true)
  })
})
