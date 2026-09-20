import { describe, expect, test } from 'bun:test'
import { stripModelDirectedGuidance } from './toolResultPresentation.js'
import { stripAssistantSlopSections } from './chatTextFilter.js'

describe('model-directed guidance never reaches the transcript', () => {
  /** Verbatim from a nemotron-3.5 turn that invented a "website" skill. */
  const unknownSkill =
    'Unknown skill: website. This is a recoverable model tool-call mistake. Do not retry an invented skill. Answer the user directly unless one of the exact listed skill names clearly applies. Available skills: brainstorming, code-review, debugging, style:modern'

  test('keeps the failure and drops the recovery instructions', () => {
    expect(stripModelDirectedGuidance(unknownSkill)).toBe('Unknown skill: website.')
  })

  test('drops the enumeration written to re-steer the model', () => {
    expect(stripModelDirectedGuidance(unknownSkill)).not.toContain('Available skills')
  })

  test('leaves a genuine tool failure untouched', () => {
    const real = "ENOENT: no such file or directory, open 'src/app.ts'"
    expect(stripModelDirectedGuidance(real)).toBe(real)
  })

  test('never blanks a row that was entirely steering', () => {
    expect(stripModelDirectedGuidance('Do not retry an invented skill.')).not.toBe('')
  })
})

describe('assistant slop sections', () => {
  test('drops a self-addressed memory-update block', () => {
    const text = [
      'I added the header component.',
      '',
      'Memory updates',
      '',
      '- goals: build a website using React',
      '- decisions: create a new React app',
    ].join('\n')
    expect(stripAssistantSlopSections(text)).toBe('I added the header component.')
  })

  test('drops a hypothetical file list the model did not actually write', () => {
    const text = [
      'Created/changed files:',
      '',
      '- src/components/ModernFeature.js (new file)',
      '- src/styles/App.css (updated file)',
      '',
      'Note: The above files are hypothetical and may not reflect the actual files created or updated in the project.',
    ].join('\n')
    // A claim the model itself disowns must not be presented as work done.
    expect(stripAssistantSlopSections(text)).toBe('')
  })

  test('keeps a real answer that merely mentions files', () => {
    const real = 'I updated src/app.ts and added a test in src/app.test.ts.'
    expect(stripAssistantSlopSections(real)).toBe(real)
  })

  test('keeps prose containing the word memory', () => {
    const real = 'The memory leak came from an unbounded cache.'
    expect(stripAssistantSlopSections(real)).toBe(real)
  })
})

/**
 * Verbatim shape from a nemotron-3.5 turn. The earlier whole-text regex missed
 * all three forms here: a heading at position 0, a bullet-form
 * `- Memory Updates:`, and a repeated block later in the same message.
 */
describe('bookkeeping blocks in a real failed-build turn', () => {
  const turn = [
    'Task Progress:',
    '',
    '- Bash Command:',
    '  - Command: npm run build && npm start',
    '  - Output: (see output file)',
    '  - Status: Failed',
    "- Error: Could not read package.json: ENOENT: no such file or directory, open 'E:\astra\package.json'",
    '- Memory Updates:',
    '  - goals: build a website using React',
    '  - decisions: run npm run build && npm start',
    '',
    'Memory updates',
    '',
    '- goals: build a website using React',
    '- decisions: create a new React app',
    '',
    'Task Status: Failed',
    '',
    'Let me try running the command again.',
  ].join('\n')

  const cleaned = stripAssistantSlopSections(turn)

  test('keeps the actual error, which is the only useful line', () => {
    expect(cleaned).toContain('Could not read package.json')
  })

  test('keeps the model\u2019s next-step sentence', () => {
    expect(cleaned).toContain('Let me try running the command again.')
  })

  test('drops every bookkeeping heading, including bullet and repeated forms', () => {
    expect(cleaned).not.toMatch(/memory updates/i)
    expect(cleaned).not.toMatch(/task progress/i)
    expect(cleaned).not.toMatch(/task status/i)
  })

  test('drops the goals/decisions the model wrote to itself', () => {
    expect(cleaned).not.toContain('goals:')
    expect(cleaned).not.toContain('decisions:')
  })

  test('drops the unusable "(see output file)" placeholder', () => {
    expect(cleaned).not.toContain('see output file')
  })
})
