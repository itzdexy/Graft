import { describe, expect, test } from 'bun:test'
import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import { AGENT_TOOL_NAME } from '../tools/AgentTool/constants.js'
import { FILE_EDIT_TOOL_NAME } from '../tools/FileEditTool/constants.js'
import {
  getGraftAgentExpansionSection,
  getGraftCostEfficiencySection,
  getGraftLearningLoopSection,
  getGraftOperatingPrinciplesSection,
  getGraftQualityAndCapabilitiesSection,
  getGraftSimpleSystemPrompt,
} from './graftSystemPrompt.js'

describe('graftSystemPrompt', () => {
  test('quality section mentions Graft and core tools', () => {
    const enabled = new Set([BASH_TOOL_NAME, AGENT_TOOL_NAME, FILE_EDIT_TOOL_NAME])
    const text = getGraftQualityAndCapabilitiesSection(enabled)
    expect(text).toContain('Graft')
    expect(text).toContain(BASH_TOOL_NAME)
    expect(text).toContain(AGENT_TOOL_NAME)
    expect(text).toContain(FILE_EDIT_TOOL_NAME)
    expect(text).toContain('SEARCH/REPLACE')
  })

  test('cost efficiency section is concise guidance', () => {
    const text = getGraftCostEfficiencySection()
    expect(text).toContain('Token and API cost efficiency')
    expect(text).toContain('parallel')
  })

  test('learning loop references buddy and retry', () => {
    const text = getGraftLearningLoopSection()
    expect(text).toContain('/buddy remember')
    expect(text).toContain('/retry')
  })

  test('operating principles emphasize verify and minimal diffs', () => {
    const text = getGraftOperatingPrinciplesSection()
    expect(text).toContain('/verify')
    expect(text).toContain('smallest correct change')
  })

  test('agent expansion lists superthink and ecosystem commands', () => {
    const text = getGraftAgentExpansionSection(new Set())
    expect(text).toContain('/superthink')
    expect(text).toContain('/ecosystem')
    expect(text).toContain('/deep-research')
  })

  test('simple system prompt uses Graft branding', () => {
    const text = getGraftSimpleSystemPrompt('/home/proj', '2026-06-24')
    expect(text).toContain('You are Graft')
    expect(text).toContain('/home/proj')
    expect(text).not.toContain('Claude')
  })
})

/**
 * Bare `graft` sets GRAFT_CODE_SIMPLE, so this prompt is what most sessions
 * run. Small models produce planning essays and invented file lists without
 * these rules stated outright.
 */
describe('simple system prompt makes models act', () => {
  const text = getGraftSimpleSystemPrompt('/home/proj', '2026-06-24')

  test('forbids describing work instead of doing it', () => {
    expect(text).toContain('Act, never describe')
    expect(text).toContain('Only tool calls change anything')
  })

  test('forbids the exact slop patterns seen in transcripts', () => {
    expect(text).toContain('hypothetical')
    expect(text).toContain('Memory updates')
    expect(text).toContain('Do not print tool calls as text')
  })

  test('names current scaffolding and rules out the deprecated one', () => {
    expect(text).toContain('npm create vite@latest')
    expect(text).toContain('create-react-app')
    expect(text).toContain('deprecated')
  })

  test('covers databases and hosting concretely', () => {
    expect(text).toContain('Databases')
    expect(text).toMatch(/sqlite/i)
    expect(text).toMatch(/postgres/i)
    expect(text).toMatch(/vercel|netlify|fly\.io/i)
    expect(text).toContain('Dockerfile')
  })

  test('teaches the cwd rule that broke a real build', () => {
    // Model scaffolded into mywebsite/ then ran npm in the parent:
    // "Could not read package.json ... E:stra\package.json".
    expect(text).toContain('Scaffolding creates a subdirectory')
    expect(text).toContain('Could not read package.json')
    expect(text).toContain('do not re-run the same failing command')
  })

  test('rules out the placeholder paths a model invents', () => {
    // Observed: Glob(**/*.md in /home/user/project) twice, cwd was E:stra.
    expect(text).toContain('/home/user/project')
    expect(text).toContain('CWD above is the only real directory')
  })

  test('forbids inventing skill names', () => {
    // Observed: Skill(deepseek), Skill(greeting-responder), Skill(style:modern).
    expect(text).toContain('Never call Skill unless the user typed that exact skill name')
    expect(text).toContain('not a topic, a model name, a greeting')
  })

  test('still requires evidence before claiming success', () => {
    expect(text).toContain('Never claim success without evidence')
  })
})

describe('no vendor leaks into the model prompt', () => {
  const VENDORS = [
    'Anthropic',
    'Claude',
    'OpenAI',
    'GPT',
    'Gemini',
    'DeepSeek',
    'Llama',
  ]

  test('the simple prompt names no model vendor', () => {
    // A model that reads a vendor name in its own system prompt concludes it
    // IS that vendor's model. A DeepSeek model on NVIDIA NIM told the user it
    // was "powered by Anthropic's Claude models" because the prompt claimed
    // every Graft model used the Anthropic Messages API.
    const text = getGraftSimpleSystemPrompt('/home/proj', '2026-06-24')
    for (const vendor of VENDORS) {
      expect(text).not.toContain(vendor)
    }
  })

  test('the capabilities section names no model vendor', () => {
    const text = getGraftQualityAndCapabilitiesSection(
      new Set(['Bash', 'Agent', 'Skill']),
    )
    for (const vendor of VENDORS) {
      expect(text).not.toContain(vendor)
    }
  })

  test('the prompt still tells the model to report its real identity', () => {
    const text = getGraftSimpleSystemPrompt('/home/proj', '2026-06-24')
    expect(text).toContain('Who you are')
    expect(text).toContain('independent CLI')
  })
})
