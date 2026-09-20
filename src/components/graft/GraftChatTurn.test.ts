import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), 'src', relativePath), 'utf8')
}

/**
 * Prose and tool rows share one left edge. The two numbers live in different
 * files, so nothing but a test stops a later edit to one from silently
 * knocking the transcript out of column.
 */
describe('transcript column alignment', () => {
  const turn = source('components/graft/GraftChatTurn.tsx')
  const toolRow = source('components/graft/GraftCompactToolRow.tsx')

  test('chat turn reserves a two-column gutter', () => {
    expect(turn).toContain('const GUTTER_WIDTH = 2')
    expect(turn).toContain('width={GUTTER_WIDTH}')
  })

  test('tool rows start their glyph one column in, so text lands at column 3', () => {
    // 1 padding + 1 glyph + 1 gap === the chat turn's 2-wide gutter + 1.
    expect(toolRow).toContain('paddingLeft={nested ? 3 : 1}')
    expect(toolRow).toContain('gap={1}')
  })

  test('roles are distinguished without a spelled-out label column', () => {
    expect(turn).not.toContain("you: 'You'")
    expect(turn).toContain('ROLE_GLYPH')
    expect(turn).toContain('ROLE_ACCENT')
  })
})
