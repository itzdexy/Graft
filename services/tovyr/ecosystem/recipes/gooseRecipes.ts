export type GooseRecipeStep = {
  id: string
  instruction: string
  /** Optional Tovyr slash command to inject. */
  command?: string
}

export type GooseRecipe = {
  id: string
  name: string
  upstream: 'goose'
  description: string
  steps: GooseRecipeStep[]
}

/** Goose-inspired recipes — multi-step workflows as ordered prompts. */
export const GOOSE_RECIPES: GooseRecipe[] = [
  {
    id: 'ship-feature',
    name: 'Ship a feature',
    upstream: 'goose',
    description: 'Plan → implement → verify → commit (Aider + Plandex patterns).',
    steps: [
      { id: 'plan', instruction: 'Write a short plan in tovyrplan.md', command: '/plan' },
      { id: 'code', instruction: 'Implement the plan with minimal scope', command: '/code' },
      { id: 'verify', instruction: 'Run test/lint/build', command: '/verify' },
      { id: 'sandbox', instruction: 'Capture diff for review', command: '/sandbox-diff capture' },
      { id: 'commit', instruction: 'Commit with tovyrcode prefix', command: '/git-commit' },
    ],
  },
  {
    id: 'fix-issue',
    name: 'Fix a GitHub issue',
    upstream: 'goose',
    description: 'OpenHands-style issue → patch flow.',
    steps: [
      { id: 'analyze', instruction: 'Analyze the issue and find root cause', command: '/repo search' },
      { id: 'debug', instruction: 'Form hypotheses', command: '/debug' },
      { id: 'fix', instruction: 'Apply fix and tests', command: '/build' },
      { id: 'verify', instruction: 'Verify', command: '/verify' },
    ],
  },
  {
    id: 'research-build',
    name: 'Superthink research build',
    upstream: 'goose',
    description: 'Plandex/Superpowers phased workflow.',
    steps: [
      { id: 'on', instruction: 'Enable superthinker', command: '/superthink on' },
      { id: 'goal', instruction: 'Run goal (research phase)', command: '/superthink' },
      { id: 'continue', instruction: 'Brainstorm questionnaire', command: '/superthink continue' },
      { id: 'go', instruction: 'Build after plan approval', command: '/superthink go' },
    ],
  },
  {
    id: 'greenfield',
    name: 'Greenfield scaffold',
    upstream: 'goose',
    description: 'gpt-engineer style new project from template.',
    steps: [
      { id: 'template', instruction: 'Pick template via /ecosystem template web-app', command: '/ecosystem template web-app' },
      { id: 'agent', instruction: 'Autonomous scaffold', command: '/agent start scaffold the project from the template preprompt' },
    ],
  },
  {
    id: 'autogpt-loop',
    name: 'AutoGPT chain',
    upstream: 'goose',
    description: 'Analyze → plan → act → reflect.',
    steps: [
      { id: 'agent', instruction: 'Start agent with AutoGPT chain', command: '/agent start follow the AutoGPT analyze-plan-act-reflect chain' },
    ],
  },
  {
    id: 'refactor-safe',
    name: 'Safe refactor',
    upstream: 'goose',
    description: 'Repo map → plan → code → verify (Aider + Continue).',
    steps: [
      { id: 'map', instruction: 'Build repo map for context', command: '/repo graph' },
      { id: 'plan', instruction: 'Plan refactor in tovyrplan.md', command: '/plan' },
      { id: 'code', instruction: 'Apply minimal refactor', command: '/code' },
      { id: 'verify', instruction: 'Run checks', command: '/verify' },
    ],
  },
  {
    id: 'deep-dive',
    name: 'Deep research report',
    upstream: 'goose',
    description: 'Odysseus-style deep research then summarize.',
    steps: [
      { id: 'research', instruction: 'Run deep research loop', command: '/deep-research' },
      { id: 'compare', instruction: 'Optional blind model compare', command: '/compare' },
    ],
  },
  {
    id: 'plandex-sandbox',
    name: 'Plandex sandbox ship',
    upstream: 'goose',
    description: 'Build with diff capture before commit.',
    steps: [
      { id: 'build', instruction: 'Implement feature', command: '/build' },
      { id: 'capture', instruction: 'Snapshot diff', command: '/sandbox-diff capture' },
      { id: 'status', instruction: 'Review sandbox', command: '/sandbox-diff status' },
      { id: 'commit', instruction: 'Commit when satisfied', command: '/git-commit' },
    ],
  },
  {
    id: 'interpret-probe',
    name: 'Open Interpreter probe',
    upstream: 'goose',
    description: 'Quick script probe then integrate.',
    steps: [
      { id: 'interpret', instruction: 'Run probe script', command: '/interpret python' },
      { id: 'integrate', instruction: 'Integrate into codebase', command: '/code' },
    ],
  },
  {
    id: 'codex-onboard',
    name: 'Codex project onboard',
    upstream: 'goose',
    description: 'AGENTS.md + execpolicy for new repos.',
    steps: [
      { id: 'agents', instruction: 'Init AGENTS.md', command: '/agents-md init' },
      { id: 'policy', instruction: 'Write execpolicy.md', command: '/ecosystem execpolicy write' },
      { id: 'analyze', instruction: 'Index repo', command: '/repo analyze' },
    ],
  },
  {
    id: 'opencode-experiment',
    name: 'OpenCode experiment',
    upstream: 'goose',
    description: 'Fork an isolated try with git branch.',
    steps: [
      { id: 'fork', instruction: 'Create experiment fork', command: '/experiment new try-approach-a' },
      { id: 'build', instruction: 'Implement in branch', command: '/code' },
      { id: 'diff', instruction: 'Capture diff', command: '/sandbox-diff capture' },
      { id: 'reflect', instruction: 'AutoGPT reflect', command: '/reflect' },
    ],
  },
  {
    id: 'openhands-issue',
    name: 'OpenHands issue fix',
    upstream: 'goose',
    description: 'Worktree isolation → resolve → verify.',
    steps: [
      { id: 'worktree', instruction: 'Isolated worktree', command: '/worktree new issue-fix' },
      { id: 'resolve', instruction: 'Resolve issue', command: '/resolve-issue' },
      { id: 'verify', instruction: 'Verify fix', command: '/verify' },
      { id: 'commit', instruction: 'Commit', command: '/git-commit' },
    ],
  },
  {
    id: 'warp-blocks',
    name: 'Warp block script',
    upstream: 'goose',
    description: 'Preview and run multi-command paste.',
    steps: [
      { id: 'preview', instruction: 'Preview blocks', command: '/warp preview' },
      { id: 'run', instruction: 'Run blocks', command: '/warp run' },
    ],
  },
  {
    id: 'continue-onboard',
    name: 'Continue dev sync',
    upstream: 'goose',
    description: 'Export Continue config + rules from AGENTS.md.',
    steps: [
      { id: 'config', instruction: 'Write config.yaml', command: '/ecosystem config continue write' },
      { id: 'rules', instruction: 'Sync rules', command: '/ecosystem config continue rules' },
      { id: 'agents', instruction: 'AGENTS.md', command: '/agents-md init' },
    ],
  },
  {
    id: 'full-rampage',
    name: 'Full ecosystem rampage',
    upstream: 'goose',
    description: 'Enable all upstream skills and show status.',
    steps: [
      { id: 'rampage', instruction: 'List ecosystem skills', command: '/ecosystem rampage' },
      { id: 'status', instruction: 'Show toggles', command: '/ecosystem status' },
      { id: 'crush', instruction: 'Compact output', command: '/crush on' },
    ],
  },
]

export function getGooseRecipe(id: string): GooseRecipe | undefined {
  return GOOSE_RECIPES.find(r => r.id === id || r.name.toLowerCase() === id.toLowerCase())
}

export function formatGooseRecipeList(): string {
  return GOOSE_RECIPES.map(
    r => `- \`${r.id}\` — **${r.name}**: ${r.description} (${r.steps.length} steps)`,
  ).join('\n')
}

export function formatGooseRecipeRun(recipe: GooseRecipe): string {
  const lines = [
    `# Recipe: ${recipe.name}`,
    '',
    recipe.description,
    '',
    'Run these steps in order (commands are suggestions):',
    '',
  ]
  recipe.steps.forEach((s, i) => {
    const cmd = s.command ? ` → \`${s.command}\`` : ''
    lines.push(`${i + 1}. **${s.id}** — ${s.instruction}${cmd}`)
  })
  return lines.join('\n')
}
