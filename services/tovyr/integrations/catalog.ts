/** Third-party integrations bundled into Tovyr (skills, commands, installers). */

export type IntegrationSource = {
  id: string
  name: string
  repo: string
  license: string
  summary: string
  skill?: string
  command?: string
}

export const TOVYR_INTEGRATIONS: IntegrationSource[] = [
  {
    id: 'taste-skill',
    name: 'Taste Skill',
    repo: 'https://github.com/Leonxlnx/taste-skill',
    license: 'MIT',
    summary: 'Anti-slop frontend design — layout, typography, motion, spacing.',
    skill: 'design-taste',
  },
  {
    id: 'vibecode',
    name: 'Vibecode Pro Max Kit',
    repo: 'https://github.com/withkynam/vibecode-pro-max-kit',
    license: 'MIT',
    summary: 'RIPER-5 plan-first workflow, PVL/EVL loops, autopilot /goal blocks.',
    skill: 'vibecode-riper5',
  },
  {
    id: 'acontext',
    name: 'Acontext',
    repo: 'https://github.com/memodb-io/Acontext',
    license: 'Apache-2.0',
    summary: 'Skill-as-memory layer — Markdown learnings from agent runs.',
    skill: 'acontext-memory',
  },
  {
    id: 'anus',
    name: 'ANUS CLI patterns',
    repo: 'https://github.com/anus-dev/ANUS',
    license: 'Apache-2.0',
    summary: 'Project context file, MCP-first tools, self-improvement ethos.',
    skill: 'anus-evolve',
  },
  {
    id: 'agency-agents',
    name: 'The Agency',
    repo: 'https://github.com/msitarzewski/agency-agents',
    license: 'MIT',
    summary: 'Specialized AI agent personas (engineering, design, marketing, …).',
    command: 'agency',
  },
  {
    id: 'odysseus-patterns',
    name: 'Odysseus patterns',
    repo: 'https://github.com/pewdiepie-archdaemon/odysseus',
    license: 'AGPL-3.0 (reference)',
    summary:
      'Self-hosted workspace patterns — deep research loop, blind compare, hardware cookbook.',
    command: 'deep-research',
  },
  {
    id: 'faker',
    name: 'Faker.js',
    repo: 'https://github.com/faker-js/faker',
    license: 'MIT',
    summary: 'Realistic fake data for tests, seeds, and demos.',
    command: 'faker',
  },
]

export function formatIntegrationsList(): string {
  const lines = TOVYR_INTEGRATIONS.map(i => {
    const hook = i.skill ? `/skill ${i.skill}` : i.command ? `/${i.command}` : ''
    return `- **${i.name}** — ${i.summary}\n  Source: ${i.repo}\n  Use: ${hook}`
  })
  return [
    '# Tovyr integrations pack',
    '',
    ...lines,
    '',
    '## Ecosystem rampage (14 upstream agents)',
    'Codex · Tovyr · Gemini CLI · OpenCode · Aider · Goose · OpenHands · Crush · Plandex · Continue · gpt-engineer · AutoGPT · Warp · Open Interpreter',
    '',
    'Run `/ecosystem` for the full catalog · `/ecosystem rampage` to list all `/skill ecosystem-*` hooks',
    'Commands: `/ecosystem status` · `/experiment` · `/crush` · `/aider` · `/warp` · `/worktree` · `/chain` · `/recipe next` · `/improve` · `/resolve-issue` · `/agents-md` · `/git-commit` · `/sandbox-diff` · `/interpret`',
  ].join('\n')
}
