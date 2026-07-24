import { describe, expect, test } from 'bun:test'
import {
  activityVerb,
  classifyTool,
  extractToolMatchCount,
  formatActivityLine,
  buildBlinkTurnFootnote,
  formatOpenCodeEpilogue,
  formatOpenCodeMetricsLine,
  formatOpenCodeShortcutHints,
  formatOpenCodeTaskTitle,
  formatOpenCodeThoughtLine,
  formatBlinkLiveStatusLabel,
  formatOpenCodeToolLine,
  formatSessionStatsLine,
  formatToolDisplayName,
  openCodeModeLabel,
  summarizeToolInput,
} from './activityDisplay.js'

describe('activityDisplay', () => {
  test('classifyTool maps write and edit tools', () => {
    expect(classifyTool('Write')).toBe('write')
    expect(classifyTool('Edit')).toBe('edit')
    expect(classifyTool('Read')).toBe('read')
    expect(classifyTool('Grep')).toBe('search')
    expect(classifyTool('Bash')).toBe('bash')
    expect(classifyTool('PowerShell')).toBe('bash')
  })

  test('summarizeToolInput prefers file paths for writes', () => {
    expect(
      summarizeToolInput('Write', { file_path: 'C:\\proj\\index.html' }),
    ).toContain('index.html')
  })

  test('bash Codex line shows Bash(command) with status dot', () => {
    const line = formatOpenCodeToolLine('Bash', { command: 'date' }, {})
    expect(line.prefix).toBe('●')
    expect(line.text).toBe('Bash(date)')
    expect(line.color).toBe('success')
  })

  test('powershell Codex in-progress line keeps shell cue', () => {
    const line = formatOpenCodeToolLine(
      'PowerShell',
      { command: 'Get-Date' },
      { inProgress: true },
    )
    expect(line.prefix).toBe('○')
    expect(line.text).toBe('PowerShell(Get-Date)')
    expect(line.color).toBe('warning')
  })

  test('formatActivityLine uses in-progress verbs', () => {
    const line = formatActivityLine('Write', 'index.html', {
      inProgress: true,
    })
    expect(line.verb).toBe('Writing')
    expect(line.detail).toBe('index.html')
    expect(line.glyph).toBe('~')
  })

  test('formatActivityLine uses past tense when done', () => {
    expect(
      activityVerb('edit', false),
    ).toBe('Edited')
    const line = formatActivityLine('Edit', 'src/app.ts', { ok: false })
    expect(line.glyph).toBe('!')
    expect(line.color).toBe('warning')
  })

  test('formatOpenCodeToolLine uses Codex status dots', () => {
    const grep = formatOpenCodeToolLine('Grep', { pattern: 'foo' })
    expect(grep.prefix).toBe('●')
    expect(grep.text).toContain('Grep(foo)')

    const read = formatOpenCodeToolLine('Read', { file_path: 'src/app.ts' })
    expect(read.prefix).toBe('●')
    expect(read.text).toContain('Read(')

    const pending = formatOpenCodeToolLine(
      'Read',
      { file_path: 'src/app.ts' },
      { inProgress: true },
    )
    expect(pending.prefix).toBe('○')
    expect(pending.text).toContain('Read(')
  })

  test('formatOpenCodeToolLine uses web and agent Codex labels', () => {
    const web = formatOpenCodeToolLine('WebFetch', {
      url: 'https://github.com/anomalyco/opencode',
    })
    expect(web.prefix).toBe('●')
    expect(web.text).toContain('WebFetch(')

    const agent = formatOpenCodeToolLine('Agent', {
      description: 'Explore codebase structure',
    })
    expect(agent.prefix).toBe('●')
    expect(agent.text).toContain('Explore(')
  })

  test('formats MCP tools as readable server/tool rows', () => {
    expect(formatToolDisplayName('mcp__github__create_issue')).toBe(
      'github/create-issue',
    )
    expect(
      summarizeToolInput('mcp__github__create_issue', {
        title: 'Fix the Windows launcher',
      }),
    ).toBe('Fix the Windows launcher')

    const done = formatOpenCodeToolLine('mcp__github__create_issue', {
      title: 'Fix the Windows launcher',
    })
    expect(done.prefix).toBe('●')
    expect(done.text).toBe(
      'MCP github/create-issue(Fix the Windows launcher)',
    )

    const pending = formatOpenCodeToolLine(
      'mcp__supabase__execute_sql',
      { query: 'select * from profiles' },
      { inProgress: true },
    )
    expect(pending.prefix).toBe('○')
    expect(pending.text).toContain('MCP supabase/execute-sql')
  })

  test('failed tool rows use red status dot without needs-attention copy', () => {
    const row = formatOpenCodeToolLine(
      'mcp__github__create_issue',
      { title: 'Bug report' },
      { ok: false },
    )
    expect(row.prefix).toBe('●')
    expect(row.color).toBe('error')
    expect(row.text).toBe('MCP github/create-issue(Bug report)')
  })

  test('read errors render as unavailable instead of broken', () => {
    const row = formatOpenCodeToolLine(
      'Read',
      { file_path: 'README.md' },
      { ok: false },
    )
    expect(row.prefix).toBe('●')
    expect(row.color).toBe('warning')
    expect(row.text).toContain('unavailable')
  })

  test('formatOpenCodeThoughtLine formats duration', () => {
    const pending = formatOpenCodeThoughtLine(undefined, true)
    expect(pending.prefix).toBe('+')
    expect(pending.text).toBe('Thought')
    expect(pending.inProgress).toBe(true)

    const done = formatOpenCodeThoughtLine(589, false)
    expect(done.text).toBe('Thought: 589ms')
  })

  test('formatBlinkLiveStatusLabel waits quietly before slow-provider escalation', () => {
    expect(
      formatBlinkLiveStatusLabel({
        streamMode: 'requesting',
        elapsedMs: 6_000,
      }),
    ).toContain('Connecting to model')
    expect(
      formatBlinkLiveStatusLabel({
        streamMode: 'responding',
        elapsedMs: 15_000,
        tokenEstimate: 0,
      }),
    ).toContain('Waiting for model')
    // Generating with tokens should not escalate
    expect(
      formatBlinkLiveStatusLabel({
        streamMode: 'responding',
        elapsedMs: 12_000,
        tokenEstimate: 40,
      }),
    ).toContain('Generating')
  })

  test('formatBlinkLiveStatusLabel maps stream phases', () => {
    expect(
      formatBlinkLiveStatusLabel({
        streamMode: 'thinking',
        elapsedMs: 589,
        spinnerVerb: 'Blinking',
      }),
    ).toContain('Thinking')
    expect(
      formatBlinkLiveStatusLabel({
        streamMode: 'responding',
        elapsedMs: 11_000,
        tokenEstimate: 83,
      }),
    ).toContain('Generating')
    expect(
      formatBlinkLiveStatusLabel({
        streamMode: 'tool-input',
      }),
    ).toContain('Preparing tool call')
  })

  test('formatBlinkLiveStatusLabel uses accurate labels by default', () => {
    delete process.env.BLINK_ACCURATE_SPINNER
    expect(
      formatBlinkLiveStatusLabel({
        streamMode: 'responding',
        spinnerVerb: 'Blinking',
      }),
    ).toContain('Waiting for first token')
  })

  test('formatBlinkLiveStatusLabel uses silly verbs when accurate spinner is off', () => {
    process.env.BLINK_ACCURATE_SPINNER = '0'
    expect(
      formatBlinkLiveStatusLabel({
        streamMode: 'thinking',
        spinnerVerb: 'Schlepping',
      }),
    ).toContain('Schlepping')
    delete process.env.BLINK_ACCURATE_SPINNER
  })

  test('openCodeModeLabel maps acceptEdits to Code', () => {
    expect(openCodeModeLabel('acceptEdits', 'prompt')).toBe('Code')
    expect(formatOpenCodeEpilogue('Build', 'Big Pickle')).toBe(
      'Build · Big Pickle',
    )
  })

  test('buildBlinkTurnFootnote includes duration mode and model', () => {
    const line = buildBlinkTurnFootnote({
      durationMs: 30_000,
      verb: 'Baked',
      modeLabel: 'Build',
      model: 'Llama 3.1',
    })
    expect(line).toBe('* Baked for 30s · Build · Llama 3.1')
  })

  test('formatSessionStatsLine joins model tokens and cost', () => {
    const line = formatSessionStatsLine({
      model: 'claude-sonnet',
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.29,
    })
    expect(line).toContain('claude-sonnet')
    expect(line).toContain('1,500 tokens')
    expect(line).toContain('$0.29')
  })

  test('formatOpenCodeMetricsLine matches OpenCode header style', () => {
    expect(
      formatOpenCodeMetricsLine({
        tokens: 39413,
        contextWindow: 200_000,
        costUsd: 0.29,
      }),
    ).toBe('39,413  20%  ($0.29)')
  })

  test('formatOpenCodeTaskTitle prefixes with hash', () => {
    expect(formatOpenCodeTaskTitle('Homepage button color change')).toBe(
      '# Homepage button color change',
    )
  })

  test('formatOpenCodeToolLine includes Grep match counts', () => {
    const line = formatOpenCodeToolLine(
      'Grep',
      { pattern: 'Home' },
      { matchCount: 18 },
    )
    expect(line.prefix).toBe('●')
    expect(line.text).toBe('Grep(Home) · 18 matches')
  })

  test('extractToolMatchCount reads Grep/Glob result fields', () => {
    expect(extractToolMatchCount({ numMatches: 18 })).toBe(18)
    expect(extractToolMatchCount({ numFiles: 100 })).toBe(100)
    expect(extractToolMatchCount(null)).toBeUndefined()
  })

  test('formatOpenCodeShortcutHints lists interrupt and commands', () => {
    expect(formatOpenCodeShortcutHints()).toContain('esc interrupt')
    expect(formatOpenCodeShortcutHints()).toContain('ctrl+p commands')
  })
})
