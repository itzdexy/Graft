export type GptEngineerTemplateId = 'web-app' | 'cli-tool' | 'api-service' | 'library'

export const GPT_ENGINEER_TEMPLATES: Record<
  GptEngineerTemplateId,
  { name: string; preprompt: string }
> = {
  'web-app': {
    name: 'Web app',
    preprompt: [
      'You are gpt-engineer scaffolding a web app.',
      'Deliver: package.json, README, src/ entry, minimal UI, dev script.',
      'Stack: pick React or vanilla based on user goal; justify in README.',
      'No placeholder lorem — use realistic copy.',
    ].join('\n'),
  },
  'cli-tool': {
    name: 'CLI tool',
    preprompt: [
      'You are gpt-engineer scaffolding a Node/Bun CLI.',
      'Deliver: bin entry, --help, subcommands, tests, README with install.',
    ].join('\n'),
  },
  'api-service': {
    name: 'API service',
    preprompt: [
      'You are gpt-engineer scaffolding a small HTTP API.',
      'Deliver: routes, validation, README, docker-compose optional, health check.',
    ].join('\n'),
  },
  library: {
    name: 'Library',
    preprompt: [
      'You are gpt-engineer scaffolding a publishable library.',
      'Deliver: src/index, tests, tsconfig, README with API examples.',
    ].join('\n'),
  },
}

export function listGptEngineerTemplates(): string {
  return Object.entries(GPT_ENGINEER_TEMPLATES)
    .map(([id, t]) => `- \`${id}\` — ${t.name}`)
    .join('\n')
}

export function getGptEngineerPreprompt(id: GptEngineerTemplateId): string {
  return GPT_ENGINEER_TEMPLATES[id].preprompt
}

/** gpt-engineer `-i` improve mode — iterate on existing code, no rescaffold. */
export function getGptEngineerImprovePreprompt(goal?: string): string {
  const focus = goal?.trim() || 'Improve this codebase per the user request'
  return [
    'You are gpt-engineer in **improve mode** (`-i`).',
    'The project already exists — do NOT delete and rescaffold.',
    '',
    `## Focus`,
    focus,
    '',
    '## Rules',
    '- Minimal diffs; preserve architecture and naming.',
    '- Run `/verify` or project test/lint after substantive edits.',
    '- Capture risky changes with `/sandbox-diff capture` before commit.',
    '- Use `/git-commit` when the user wants to ship.',
  ].join('\n')
}

export function formatGptEngineerHelp(): string {
  return [
    '# gpt-engineer patterns',
    '',
    'Codegen from natural language — greenfield templates and improve mode.',
    '',
    '## Commands',
    '- `/ecosystem template <id>` — scaffold preprompts',
    `- Templates: ${Object.keys(GPT_ENGINEER_TEMPLATES).join(', ')}`,
    '- `/improve [goal]` — improve mode (`-i`) on existing repos',
    '',
    '## Rules',
    'Greenfield: full tree. Improve: minimal diffs, no rescaffold.',
  ].join('\n')
}
