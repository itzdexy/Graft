import { describe, expect, test } from 'bun:test'
import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import { AGENT_TOOL_NAME } from '../tools/AgentTool/constants.js'
import { FILE_EDIT_TOOL_NAME } from '../tools/FileEditTool/constants.js'
import {
  getTovyrAgentExpansionSection,
  getTovyrCostEfficiencySection,
  getTovyrLearningLoopSection,
  getTovyrOperatingPrinciplesSection,
  getTovyrQualityAndCapabilitiesSection,
  getTovyrSimpleSystemPrompt,
} from './kairoSystemPrompt.js'

describe('kairoSystemPrompt', () => {
  test('quality section mentions Tovyr and core tools', () => {
    const enabled = new Set([BASH_TOOL_NAME, AGENT_TOOL_NAME, FILE_EDIT_TOOL_NAME])
    const text = getTovyrQualityAndCapabilitiesSection(enabled)
    expect(text).toContain('Tovyr')
    expect(text).toContain(BASH_TOOL_NAME)
    expect(text).toContain(AGENT_TOOL_NAME)
    expect(text).toContain(FILE_EDIT_TOOL_NAME)
    expect(text).toContain('SEARCH/REPLACE')
  })

  test('cost efficiency section is concise guidance', () => {
    const text = getTovyrCostEfficiencySection()
    expect(text).toContain('Token and API cost efficiency')
    expect(text).toContain('parallel')
  })

  test('learning loop references buddy and retry', () => {
    const text = getTovyrLearningLoopSection()
    expect(text).toContain('/buddy remember')
    expect(text).toContain('/retry')
  })

  test('operating principles emphasize verify and minimal diffs', () => {
    const text = getTovyrOperatingPrinciplesSection()
    expect(text).toContain('/verify')
    expect(text).toContain('smallest correct change')
  })

  test('agent expansion lists superthink and ecosystem commands', () => {
    const text = getTovyrAgentExpansionSection(new Set())
    expect(text).toContain('/superthink')
    expect(text).toContain('/ecosystem')
    expect(text).toContain('/deep-research')
  })

  test('simple system prompt uses Tovyr branding', () => {
    const text = getTovyrSimpleSystemPrompt('/home/proj', '2026-06-24')
    expect(text).toContain('You are Tovyr')
    expect(text).toContain('/home/proj')
    expect(text).not.toContain('Claude')
  })
})
