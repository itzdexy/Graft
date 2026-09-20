import { describe, expect, test } from 'bun:test'
import { classifyTool, formatOpenCodeToolLine } from './activityDisplay.js'

/**
 * Both defects here were found by rendering a tool row and reading it, not by
 * type-checking: the label and the status mark were each wrong in a way that
 * still compiled and still passed every existing test.
 */
describe('tool row labels name the tool that actually ran', () => {
  test('Glob is a search, not a read', () => {
    // classifyTool put Glob in READ_TOOLS, so formatOpenCodeToolLine took its
    // read branch and renamed it: `Glob "*"` rendered as `Read "*"`.
    expect(classifyTool('Glob')).toBe('search')
  })

  test('a Glob row says Glob', () => {
    const line = formatOpenCodeToolLine('Glob', { pattern: '**/*.ts' }, {})
    expect(line.text).toContain('Glob')
    expect(line.text).not.toContain('Read')
  })

  test('a failed Glob still says Glob', () => {
    const line = formatOpenCodeToolLine('Glob', { pattern: '*' }, { ok: false })
    expect(line.text).toContain('Glob')
    // The read branch appended "unavailable" to a tool that never ran a read.
    expect(line.text).not.toContain('unavailable')
  })

  test('Grep and Read keep their own names', () => {
    expect(formatOpenCodeToolLine('Grep', { pattern: 'x' }, {}).text).toContain(
      'Grep',
    )
    expect(
      formatOpenCodeToolLine('Read', { file_path: 'a.ts' }, {}).text,
    ).toContain('Read')
    expect(classifyTool('Read')).toBe('read')
    expect(classifyTool('LS')).toBe('read')
  })
})

describe('status marks distinguish failure from success', () => {
  test('a failure is marked differently from a success', () => {
    const ok = formatOpenCodeToolLine('Write', { file_path: 'a.ts' }, { ok: true })
    const bad = formatOpenCodeToolLine('Write', { file_path: 'a.ts' }, { ok: false })
    // Previously both were '●' and only the colour differed, which is invisible
    // on a mono terminal and easy to miss when scrolling.
    expect(bad.prefix).not.toBe(ok.prefix)
    expect(bad.prefix).toBe('✗')
  })

  test('a read miss stays soft — it is routine, not a failure', () => {
    // The agent probing for a file that may not exist should not look like
    // something broke. The word "unavailable" carries the state here, so the
    // neutral dot is kept deliberately.
    const miss = formatOpenCodeToolLine('Read', { file_path: 'a.ts' }, { ok: false })
    expect(miss.prefix).toBe('●')
    expect(miss.color).toBe('warning')
    expect(miss.text).toContain('unavailable')
  })

  test('in-progress is distinct from both', () => {
    const running = formatOpenCodeToolLine(
      'Write',
      { file_path: 'a.ts' },
      { inProgress: true },
    )
    expect(running.prefix).toBe('→')
  })

  test('failure colour is still error', () => {
    const bad = formatOpenCodeToolLine('Bash', { command: 'x' }, { ok: false })
    expect(bad.color).toBe('error')
  })
})
