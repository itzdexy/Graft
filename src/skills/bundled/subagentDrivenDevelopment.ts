import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { AGENT_TOOL_NAME } from '../../tools/AgentTool/constants.js'
import { registerBundledSkill } from '../bundledSkills.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'

const PROMPT = `# Subagent-driven development

Use this pattern for large features, broad repo exploration, or parallel workstreams (inspired by Hermes Agent optional skills).

## When to use

- The task spans many files or packages and a single thread will thrash context.
- Independent subtasks can run in parallel (research + implementation, multiple modules).
- Review or exploration should not pollute the main conversation.

## Workflow

1. **Decompose** — Break the user goal into 2–5 subtasks with clear inputs, outputs, and file paths.
2. **Delegate** — Spawn subagents via \`${AGENT_TOOL_NAME}\` with explicit constraints (read-only vs edit, directories, success criteria).
3. **Parallelize** — Launch independent subagents in one turn when safe; do not duplicate the same search across agents.
4. **Synthesize** — Merge results in the main thread: decisions, diffs, risks, and what you could not verify.
5. **Persist** — For repeatable workflows, offer \`/skillify\` or a project skill; for durable facts, \`/buddy remember\`.

## Rules

- Never paste raw subagent dumps — summarize and cite paths.
- Main thread owns user communication and final edits unless a subagent was tasked with a scoped file set.
- If a subagent fails, retry with a narrower prompt before escalating to the user.
`

export function registerSubagentDrivenDevelopmentSkill(): void {
  registerBundledSkill({
    name: 'subagent-driven-development',
    description:
      'Hermes-style pattern: decompose work, delegate to subagents, synthesize results',
    aliases: ['subagent-dev', 'delegate-dev'],
    whenToUse:
      'Large multi-file features, parallel research, or when context is getting crowded',
    userInvocable: true,
    isEnabled: () => isGraftRuntime(),
    async getPromptForCommand(): Promise<ContentBlockParam[]> {
      return [{ type: 'text', text: PROMPT }]
    },
  })
}
