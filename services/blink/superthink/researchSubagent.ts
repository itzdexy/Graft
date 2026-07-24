import type { Message } from '../../../types/message.js'
import type { ToolUseContext } from '../../../Tool.js'
import type { CanUseToolFn } from '../../../hooks/useCanUseTool.js'
import { runAgent } from '../../../tools/AgentTool/runAgent.js'
import { GENERAL_PURPOSE_AGENT } from '../../../tools/AgentTool/built-in/generalPurposeAgent.js'
import { extractResultText } from '../../../utils/forkedAgent.js'
import { createUserMessage } from '../../../utils/messages.js'
import { extractUrlsFromText } from '../ecosystem/prompt/enrich.js'
import { designDocPath, researchBriefPath } from './researchStore.js'

export function buildSuperthinkResearchSubagentPrompt(
  cwd: string,
  goal: string,
): string {
  const researchPath = researchBriefPath(cwd, goal)
  const designPath = designDocPath(cwd, goal)
  const urls = extractUrlsFromText(goal).slice(0, 8)
  const urlSection =
    urls.length > 0
      ? ['', 'URLs in goal (WebFetch first):', ...urls.map(u => `- ${u}`)].join('\n')
      : ''

  return [
    '# Superthinker research subagent',
    '',
    'You are a **research-only** background subagent for Blink Superthinker.',
    'Phase 1 of Superpowers-style workflow — understand before build.',
    '',
    '## Hard rules',
    '- Use **WebSearch** and **WebFetch** tools for research — invoke them, never print tool syntax',
    '- Do **NOT** output `<|python_tag|>`, `/websearch`, `websearch.call`, or fake tool calls in chat',
    '- Do **NOT** write application code or edit project source files',
    '- Save files with the Write tool to the paths below only',
    '',
    `## Goal`,
    goal.trim(),
    urlSection,
    '',
    '## Deliverables (required)',
    `1. Research brief → \`${researchPath}\``,
    '   Sections: Summary, Findings (with URLs), Recommended approach, Risks, Open questions',
    `2. Design outline → \`${designPath}\``,
    '   First line: `goal: <exact goal text>`',
    '',
    '## Final reply',
    'One short paragraph: paths saved + top recommendation. No full brief in chat.',
  ].join('\n')
}

export async function* runSuperthinkResearchAgent(
  cwd: string,
  goal: string,
  context: ToolUseContext,
  canUseTool: CanUseToolFn,
): AsyncGenerator<Message> {
  const prompt = buildSuperthinkResearchSubagentPrompt(cwd, goal)
  yield* runAgent({
    agentDefinition: GENERAL_PURPOSE_AGENT,
    promptMessages: [createUserMessage({ content: prompt })],
    toolUseContext: context,
    canUseTool,
    isAsync: false,
    querySource: 'agent:custom',
    availableTools: context.options.tools,
    transcriptSubdir: 'superthink',
    description: `superthink research: ${goal.slice(0, 80)}`,
  })
}

export function extractResearchAgentSummary(messages: Message[]): string {
  return extractResultText(messages, 'Research subagent finished.')
}
