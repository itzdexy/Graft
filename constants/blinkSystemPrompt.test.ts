import { describe, expect, test } from 'bun:test'
import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import { AGENT_TOOL_NAME } from '../tools/AgentTool/constants.js'
import { FILE_EDIT_TOOL_NAME } from '../tools/FileEditTool/constants.js'
import {
  getBlinkAgentExpansionSection,
  getBlinkCostEfficiencySection,
  getBlinkLearningLoopSection,
  getBlinkOperatingPrinciplesSection,
  getBlinkQualityAndCapabilitiesSection,
  getBlinkSimpleSystemPrompt,
} from './blinkSystemPrompt.js'

describe('blinkSystemPrompt', () => {
  test('quality section mentions Blink and core tools', () => {
    const enabled = new Set([BASH_TOOL_NAME, AGENT_TOOL_NAME, FILE_EDIT_TOOL_NAME])
    const text = getBlinkQualityAndCapabilitiesSection(enabled)
    expect(text).toContain('Blink')
    expect(text).toContain(BASH_TOOL_NAME)
    expect(text).toContain(AGENT_TOOL_NAME)
    expect(text).toContain(FILE_EDIT_TOOL_NAME)
    expect(text).toContain('SEARCH/REPLACE')
  })

  test('cost efficiency section is concise guidance', () => {
    const text = getBlinkCostEfficiencySection()
    expect(text).toContain('Token and API cost efficiency')
    expect(text).toContain('parallel')
  })

  test('learning loop references buddy and retry', () => {
    const text = getBlinkLearningLoopSection()
    expect(text).toContain('/buddy remember')
    expect(text).toContain('/retry')
  })

  test('operating principles emphasize verify and minimal diffs', () => {
    const text = getBlinkOperatingPrinciplesSection()
    expect(text).toContain('/verify')
    expect(text).toContain('smallest correct change')
  })

  test('agent expansion lists superthink and ecosystem commands', () => {
    const text = getBlinkAgentExpansionSection(new Set())
    expect(text).toContain('/superthink')
    expect(text).toContain('/ecosystem')
    expect(text).toContain('/deep-research')
  })

  test('simple system prompt uses Blink branding', () => {
    const text = getBlinkSimpleSystemPrompt('/home/proj', '2026-06-24')
    expect(text).toContain('You are Blink')
    expect(text).toContain('/home/proj')
    expect(text).not.toContain('Claude')
  })

  test('simple system prompt tells model to use shell for time and web tools for live facts', () => {
    const text = getBlinkSimpleSystemPrompt('/home/proj', '2026-06-24')
    expect(text).toContain('Get-Date')
    expect(text).toContain('never say you lack a clock')
    expect(text).toContain('WebSearch')
    expect(text).toContain('never claim no web access')
    expect(text).toContain('calendar day only')
    expect(text).not.toContain('skills, MCP')
  })
})
