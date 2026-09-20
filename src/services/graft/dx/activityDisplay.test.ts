import { describe, expect, test } from 'bun:test'
import {
  activityVerb,
  classifyTool,
  extractToolMatchCount,
  formatActivityLine,
  buildGraftTurnFootnote,
  formatOpenCodeEpilogue,
  formatOpenCodeMetricsLine,
  formatOpenCodeShortcutHints,
  formatOpenCodeTaskTitle,
  formatOpenCodeThoughtLine,
  formatGraftLiveStatusLabel,
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
    expect(line.text).toBe('Bash "date"')
    expect(line.color).toBe('success')
  })

  test('powershell in-progress line keeps shell cue', () => {
    const line = formatOpenCodeToolLine(
      'PowerShell',
      { command: 'Get-Date' },
      { inProgress: true },
    )
    expect(line.prefix).toBe('→')
    expect(line.text).toBe('PowerShell "Get-Date"')
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

  test('formatOpenCodeToolLine uses opencode status marks', () => {
    const grep = formatOpenCodeToolLine('Grep', { pattern: 'foo' })
    expect(grep.prefix).toBe('●')
    expect(grep.text).toContain('Grep "foo"')

    const read = formatOpenCodeToolLine('Read', { file_path: 'src/app.ts' })
    expect(read.prefix).toBe('●')
    expect(read.text).toContain('Read "')

    const pending = formatOpenCodeToolLine(
      'Read',
      { file_path: 'src/app.ts' },
      { inProgress: true },
    )
    expect(pending.prefix).toBe('→')
    expect(pending.text).toContain('Read "')
  })

  test('formatOpenCodeToolLine uses web and agent opencode labels', () => {
    const web = formatOpenCodeToolLine('WebFetch', {
      url: 'https://github.com/anomalyco/opencode',
    })
    expect(web.prefix).toBe('●')
    expect(web.text).toContain('Fetch "')

    const agent = formatOpenCodeToolLine('Agent', {
      description: 'Explore codebase structure',
    })
    expect(agent.prefix).toBe('●')
    expect(agent.text).toContain('Explore "')
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
      'MCP github/create-issue "Fix the Windows launcher"',
    )

    const pending = formatOpenCodeToolLine(
      'mcp__supabase__execute_sql',
      { query: 'select * from profiles' },
      { inProgress: true },
    )
    expect(pending.prefix).toBe('→')
    expect(pending.text).toContain('MCP supabase/execute-sql')
  })

  test('a genuinely failed tool row is marked, not just recoloured', () => {
    const row = formatOpenCodeToolLine(
      'mcp__github__create_issue',
      { title: 'Bug report' },
      { ok: false },
    )
    // Was '●' with only the colour changing, which is indistinguishable from a
    // success on a mono terminal, for a colour-blind reader, or when skimming.
    expect(row.prefix).toBe('✗')
    expect(row.color).toBe('error')
    // Still no alarmist extra copy — the mark carries it.
    expect(row.text).toBe('MCP github/create-issue "Bug report"')
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

  test('formatGraftLiveStatusLabel waits quietly before slow-provider escalation', () => {
    expect(
      formatGraftLiveStatusLabel({
        streamMode: 'requesting',
        elapsedMs: 6_000,
      }),
    ).toContain('Connecting to model')
    expect(
      formatGraftLiveStatusLabel({
        streamMode: 'responding',
        elapsedMs: 15_000,
        tokenEstimate: 0,
      }),
    ).toContain('Provider is slow')
    // Generating with tokens should not escalate
    expect(
      formatGraftLiveStatusLabel({
        streamMode: 'responding',
        elapsedMs: 12_000,
        tokenEstimate: 40,
      }),
    ).toContain('Generating')
  })

  test('formatGraftLiveStatusLabel surfaces degraded provider state', () => {
    expect(
      formatGraftLiveStatusLabel({
        streamMode: 'responding',
        elapsedMs: 12_000,
        tokenEstimate: 0,
        connectionState: 'degraded',
      }),
    ).toContain('Provider degraded')
  })

  test('formatGraftLiveStatusLabel maps stream phases', () => {
    // Literal phase labels are the opt-in mode.
    process.env.GRAFT_ACCURATE_SPINNER = '1'
    expect(
      formatGraftLiveStatusLabel({
        streamMode: 'thinking',
        elapsedMs: 589,
        spinnerVerb: 'Grafting',
      }),
    ).toContain('Thinking')
    expect(
      formatGraftLiveStatusLabel({
        streamMode: 'responding',
        elapsedMs: 11_000,
        tokenEstimate: 83,
      }),
    ).toContain('Generating')
    expect(
      formatGraftLiveStatusLabel({
        streamMode: 'tool-input',
      }),
    ).toContain('Preparing tool call')
    delete process.env.GRAFT_ACCURATE_SPINNER
  })

  test('ignores a playful verb by default in favour of the real phase', () => {
    // The default flipped: a random verb tells the reader nothing, and during a
    // stall "Julienning · 155s" hides the fact that the model has gone quiet.
    delete process.env.GRAFT_ACCURATE_SPINNER
    const label = formatGraftLiveStatusLabel({
      streamMode: 'responding',
      spinnerVerb: 'Grafting',
    })
    expect(label).not.toContain('Grafting')
    expect(label).toContain('Waiting for first token')
  })

  test('playful verbs remain available via GRAFT_ACCURATE_SPINNER=0', () => {
    process.env.GRAFT_ACCURATE_SPINNER = '0'
    expect(
      formatGraftLiveStatusLabel({
        streamMode: 'responding',
        spinnerVerb: 'Grafting',
      }),
    ).toContain('Grafting')
    delete process.env.GRAFT_ACCURATE_SPINNER
  })

  test('falls back to the phase label when no verb was supplied', () => {
    delete process.env.GRAFT_ACCURATE_SPINNER
    expect(
      formatGraftLiveStatusLabel({ streamMode: 'responding' }),
    ).toContain('Waiting for first token')
  })

  test('formatGraftLiveStatusLabel uses silly verbs when accurate spinner is off', () => {
    process.env.GRAFT_ACCURATE_SPINNER = '0'
    expect(
      formatGraftLiveStatusLabel({
        streamMode: 'thinking',
        spinnerVerb: 'Schlepping',
      }),
    ).toContain('Schlepping')
    delete process.env.GRAFT_ACCURATE_SPINNER
  })

  test('openCodeModeLabel maps acceptEdits to Code', () => {
    expect(openCodeModeLabel('acceptEdits', 'prompt')).toBe('Code')
    expect(formatOpenCodeEpilogue('Build', 'Big Pickle')).toBe(
      'Build · Big Pickle',
    )
  })

  test('buildGraftTurnFootnote includes duration mode and model', () => {
    const line = buildGraftTurnFootnote({
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

  test('formatOpenCodeTaskTitle returns the bare title (header draws the #)', () => {
    expect(formatOpenCodeTaskTitle('Homepage button color change')).toBe(
      'Homepage button color change',
    )
  })

  test('formatOpenCodeTaskTitle strips a leading hash so the header cannot double it', () => {
    expect(formatOpenCodeTaskTitle('# build me a browser')).toBe(
      'build me a browser',
    )
    expect(formatOpenCodeTaskTitle('## still one title')).toBe('still one title')
  })

  test('formatOpenCodeTaskTitle falls back to Session when empty', () => {
    expect(formatOpenCodeTaskTitle('   ')).toBe('Session')
    expect(formatOpenCodeTaskTitle('#')).toBe('Session')
  })

  test('formatOpenCodeToolLine includes Grep match counts', () => {
    const line = formatOpenCodeToolLine(
      'Grep',
      { pattern: 'Home' },
      { matchCount: 18 },
    )
    expect(line.prefix).toBe('●')
    expect(line.text).toBe('Grep "Home" · 18 matches')
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
