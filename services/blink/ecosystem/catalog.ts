import type { EcosystemUpstream, EcosystemUpstreamId } from './types.js'

/** Open-source coding agents ported / adapted into Blink. */
export const ECOSYSTEM_UPSTREAMS: EcosystemUpstream[] = [
  {
    id: 'claude-code',
    name: 'Blink',
    repo: 'https://github.com/Dexyy2/Blink-code-cli',
    license: 'MIT',
    stars: 'N/A',
    summary: 'Agentic terminal IDE — Blink is built on this stack.',
    skill: 'ecosystem-claude-code',
    features: [
      {
        id: 'slash-commands',
        label: 'Slash commands & skills',
        summary: 'Plugin skills, MCP, forked subagents.',
        blinkHook: '/skills',
        impl: 'commands/',
      },
      {
        id: 'plan-code',
        label: 'Plan / code modes',
        summary: 'Structured plan-then-implement workflow.',
        blinkHook: '/plan · /code',
      },
      {
        id: 'subagents',
        label: 'Subagents & hooks',
        summary: 'Forked agents, compaction, automation hooks.',
        blinkHook: '/agent · /hooks',
        impl: 'commands/blink/agent.ts',
      },
    ],
  },
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    repo: 'https://github.com/openai/codex',
    license: 'Apache-2.0',
    stars: '—',
    summary: 'Lightweight coding agent with approval modes and AGENTS.md.',
    skill: 'ecosystem-codex',
    features: [
      {
        id: 'approval-modes',
        label: 'Approval modes',
        summary: 'Suggest / auto / full-auto tool policies.',
        blinkHook: '/mode',
        impl: 'services/blink/ecosystem/adapters/codex.ts',
      },
      {
        id: 'agents-md',
        label: 'AGENTS.md context',
        summary: 'Project agent instructions file.',
        blinkHook: '/agents-md init',
        impl: 'services/blink/context/agentsMd.ts',
      },
      {
        id: 'execpolicy',
        label: 'execpolicy.md',
        summary: 'Document shell/tool approval policy.',
        blinkHook: '/ecosystem execpolicy write',
        impl: 'services/blink/ecosystem/codex/execPolicy.ts',
      },
    ],
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    repo: 'https://github.com/google-gemini/gemini-cli',
    license: 'Apache-2.0',
    summary: 'Gemini in the terminal — @file context and grounding.',
    skill: 'ecosystem-gemini-cli',
    features: [
      {
        id: 'at-files',
        label: '@file context',
        summary: 'Expand @paths into prompt attachments.',
        blinkHook: '@ in prompt (auto-enrich)',
        impl: 'services/blink/ecosystem/prompt/enrich.ts',
      },
      {
        id: 'mcp',
        label: 'MCP tools',
        summary: 'Model Context Protocol integrations.',
        blinkHook: '/mcp',
      },
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    repo: 'https://github.com/anomalyco/opencode',
    license: 'MIT',
    summary: 'Multi-model open agent with session forking.',
    skill: 'ecosystem-opencode',
    features: [
      {
        id: 'session-fork',
        label: 'Session fork metadata',
        summary: 'Branch conversations for experiments.',
        blinkHook: '/experiment new',
        impl: 'services/blink/ecosystem/opencode/forkStore.ts',
      },
      {
        id: 'lsp',
        label: 'LSP context',
        summary: 'Language-server aware edits.',
        blinkHook: 'ENABLE_LSP_TOOL + /repo analyze',
        impl: 'services/blink/lsp/lspContext.ts',
      },
    ],
  },
  {
    id: 'aider',
    name: 'Aider',
    repo: 'https://github.com/Aider-AI/aider',
    license: 'Apache-2.0',
    stars: '47k',
    summary: 'Pair programming — repo map, SEARCH/REPLACE, git commits.',
    skill: 'ecosystem-aider',
    features: [
      {
        id: 'search-replace',
        label: 'SEARCH/REPLACE blocks',
        summary: 'Aider-style edit markers in tool output.',
        blinkHook: '/aider format',
        impl: 'services/blink/edits/aiderBlocks.ts',
      },
      {
        id: 'repo-map',
        label: 'Repo map',
        summary: 'Ranked symbol map for context.',
        blinkHook: '/repo graph',
        impl: 'services/blink/repo/repoMap.ts',
      },
      {
        id: 'git-commit',
        label: 'Auto git commit',
        summary: 'Commit after edits with blinkcode: prefix.',
        blinkHook: '/git-commit',
        impl: 'services/blink/git/checkpoint.ts',
      },
      {
        id: 'lint-hint',
        label: 'Post-edit lint hint',
        summary: 'Suggest test/lint after edits (auto-verify).',
        blinkHook: '/aider lint',
        impl: 'services/blink/ecosystem/lint/suggestLint.ts',
      },
      {
        id: 'aider-cmd',
        label: 'Aider cheat sheet',
        summary: 'SEARCH/REPLACE, map, lint in one place.',
        blinkHook: '/aider',
        impl: 'services/blink/ecosystem/adapters/aider.ts',
      },
    ],
  },
  {
    id: 'goose',
    name: 'Goose',
    repo: 'https://github.com/aaif-goose/goose',
    license: 'Apache-2.0',
    stars: '50k',
    summary: 'Extensible agent — recipes and MCP extensions.',
    skill: 'ecosystem-goose',
    features: [
      {
        id: 'recipes',
        label: 'Recipes',
        summary: 'Multi-step scripted workflows.',
        blinkHook: '/recipe',
        impl: 'services/blink/ecosystem/recipes/gooseRecipes.ts',
      },
      {
        id: 'mcp-extensions',
        label: 'MCP extensions',
        summary: 'Compose MCP tools before shell one-offs.',
        blinkHook: '/mcp',
      },
    ],
  },
  {
    id: 'openhands',
    name: 'OpenHands',
    repo: 'https://github.com/OpenHands/OpenHands',
    license: 'MIT',
    stars: '—',
    summary: 'Sandboxed dev agent — issue resolver patterns.',
    skill: 'ecosystem-openhands',
    features: [
      {
        id: 'issue-resolver',
        label: 'Issue resolver',
        summary: 'GitHub issue → patch workflow prompt.',
        blinkHook: '/resolve-issue',
        impl: 'services/blink/ecosystem/adapters/openhands.ts',
      },
      {
        id: 'worktree',
        label: 'Git worktree isolation',
        summary: 'Sandbox fixes in a linked worktree.',
        blinkHook: '/worktree new',
        impl: 'services/blink/ecosystem/openhands/worktree.ts',
      },
    ],
  },
  {
    id: 'crush',
    name: 'Crush',
    repo: 'https://github.com/charmbracelet/crush',
    license: 'MIT',
    summary: 'Charm terminal agent — keyboard-first TUI patterns.',
    skill: 'ecosystem-crush',
    features: [
      {
        id: 'tui-shortcuts',
        label: 'TUI shortcuts',
        summary: 'Crush-style keybinding hints for Blink REPL.',
        blinkHook: '/crush shortcuts',
        impl: 'services/blink/ecosystem/adapters/crush.ts',
      },
      {
        id: 'compact-mode',
        label: 'Compact output',
        summary: 'Bullet-short replies; footer crush badge.',
        blinkHook: '/crush on',
        impl: 'services/blink/ecosystem/crush/state.ts',
      },
    ],
  },
  {
    id: 'plandex',
    name: 'Plandex',
    repo: 'https://github.com/plandex-ai/plandex',
    license: 'MIT',
    stars: '15.5k',
    summary: 'Plan-and-execute with cumulative diff sandbox.',
    skill: 'ecosystem-plandex',
    features: [
      {
        id: 'diff-sandbox',
        label: 'Diff sandbox',
        summary: 'Review AI edits before applying to tree.',
        blinkHook: '/sandbox-diff',
        impl: 'services/blink/ecosystem/sandbox/diffReview.ts',
      },
      {
        id: 'superthink',
        label: 'Phased plan → build',
        summary: 'Research, Q&A, plan approval, build.',
        blinkHook: '/superthink',
        impl: 'services/blink/superthink/',
      },
      {
        id: 'plan-versions',
        label: 'Plan version branches',
        summary: 'Snapshot blinkplan.md variants per goal.',
        blinkHook: '/ecosystem plan save',
        impl: 'services/blink/ecosystem/sandbox/planVersions.ts',
      },
    ],
  },
  {
    id: 'continue',
    name: 'Continue',
    repo: 'https://github.com/continuedev/continue',
    license: 'Apache-2.0',
    stars: '34k',
    summary: 'Open coding agent — config fragments and slash rules.',
    skill: 'ecosystem-continue',
    features: [
      {
        id: 'config-fragment',
        label: 'config.yaml fragment',
        summary: 'Export Continue-compatible rules snippet.',
        blinkHook: '/ecosystem config continue',
        impl: 'services/blink/ecosystem/adapters/continue-dev.ts',
      },
      {
        id: 'rules-sync',
        label: 'Rules sync',
        summary: 'Mirror AGENTS.md into .continue/rules/blink.md.',
        blinkHook: '/ecosystem config continue rules',
        impl: 'services/blink/ecosystem/continue/syncRules.ts',
      },
    ],
  },
  {
    id: 'gpt-engineer',
    name: 'gpt-engineer',
    repo: 'https://github.com/AntonOsika/gpt-engineer',
    license: 'MIT',
    stars: '55k',
    summary: 'Codegen from natural language — preprompts and templates.',
    skill: 'ecosystem-gpt-engineer',
    features: [
      {
        id: 'templates',
        label: 'Project templates',
        summary: 'Scaffold prompts for greenfield apps.',
        blinkHook: '/ecosystem template',
        impl: 'services/blink/ecosystem/adapters/gpt-engineer.ts',
      },
      {
        id: 'improve',
        label: 'Improve mode (-i)',
        summary: 'Iterate on existing codebase without rescaffold.',
        blinkHook: '/improve',
        impl: 'services/blink/ecosystem/adapters/gpt-engineer.ts',
      },
    ],
  },
  {
    id: 'autogpt',
    name: 'AutoGPT',
    repo: 'https://github.com/Significant-Gravitas/AutoGPT',
    license: 'MIT',
    stars: '—',
    summary: 'Autonomous agent chains and benchmarks.',
    skill: 'ecosystem-autogpt',
    features: [
      {
        id: 'agent-chain',
        label: 'Agent chain',
        summary: 'Think → plan → act → reflect loop.',
        blinkHook: '/agent start',
        impl: 'services/blink/agent/',
      },
      {
        id: 'reflect',
        label: 'Reflect step',
        summary: 'Explicit reflect phase prompt.',
        blinkHook: '/reflect',
        impl: 'services/blink/ecosystem/adapters/autogpt.ts',
      },
      {
        id: 'chain',
        label: 'Full agent chain',
        summary: 'Analyze → plan → act → reflect in one flow.',
        blinkHook: '/chain start',
        impl: 'commands/blink/chain.impl.ts',
      },
    ],
  },
  {
    id: 'warp',
    name: 'Warp',
    repo: 'https://github.com/warpdotdev/Warp',
    license: 'Proprietary',
    summary: 'Block-based terminal — command block parsing.',
    skill: 'ecosystem-warp',
    features: [
      {
        id: 'command-blocks',
        label: 'Command blocks',
        summary: 'Parse multi-command paste into steps.',
        blinkHook: '/warp preview',
        impl: 'services/blink/ecosystem/adapters/warp.ts',
      },
      {
        id: 'block-runner',
        label: 'Block runner',
        summary: 'Execute Warp blocks in order via agent.',
        blinkHook: '/warp run',
        impl: 'services/blink/ecosystem/warp/runBlocks.ts',
      },
    ],
  },
  {
    id: 'openinterpreter',
    name: 'Open Interpreter',
    repo: 'https://github.com/openinterpreter/openinterpreter',
    license: 'AGPL-3.0',
    stars: '—',
    summary: 'Local code execution agent for open models.',
    skill: 'ecosystem-openinterpreter',
    features: [
      {
        id: 'interpret',
        label: 'Interpret mode',
        summary: 'Run Python/JS in sandboxed Bash with guardrails.',
        blinkHook: '/interpret',
        impl: 'services/blink/ecosystem/adapters/openinterpreter.ts',
      },
      {
        id: 'guardrails',
        label: 'Execution guardrails',
        summary: 'Retry-once, no network unless asked.',
        blinkHook: '/interpret',
        impl: 'services/blink/ecosystem/adapters/openinterpreter.ts',
      },
    ],
  },
]

export function getUpstream(id: EcosystemUpstreamId): EcosystemUpstream | undefined {
  return ECOSYSTEM_UPSTREAMS.find(u => u.id === id)
}

export function listEcosystemFeatureCount(): number {
  return ECOSYSTEM_UPSTREAMS.reduce((n, u) => n + u.features.length, 0)
}

export function formatEcosystemCatalog(compact = false): string {
  const lines = [
    '# Blink ecosystem rampage',
    '',
    `Ports patterns from **${ECOSYSTEM_UPSTREAMS.length}** open-source coding agents ` +
      `(${listEcosystemFeatureCount()} features wired).`,
    '',
  ]
  for (const u of ECOSYSTEM_UPSTREAMS) {
    if (compact) {
      lines.push(`- **${u.name}** — ${u.summary} · ${u.repo}`)
      continue
    }
    lines.push(`## ${u.name}`)
    lines.push(`${u.summary}`)
    lines.push(`Source: ${u.repo} · License: ${u.license}`)
    if (u.skill) lines.push(`Skill: \`/skill ${u.skill}\``)
    lines.push('')
    for (const f of u.features) {
      const hook = f.blinkHook ? ` → \`${f.blinkHook}\`` : ''
      lines.push(`- **${f.label}** — ${f.summary}${hook}`)
    }
    lines.push('')
  }
  lines.push('## Commands')
  lines.push('- `/ecosystem` — this catalog · `/ecosystem status` — active toggles')
  lines.push('- `/ecosystem rampage` — enable all ecosystem skills for the session')
  lines.push('- `/recipe list|run <id>|start <id>` — Goose-style workflows (start auto-runs step 1)')
  lines.push('- `/improve [goal]` — gpt-engineer improve mode (-i)')
  lines.push('- `/resolve-issue <url>` — OpenHands issue workflow')
  lines.push('- `/agents-md init|show` — AGENTS.md template')
  lines.push('- `/ecosystem plan save|list` — Plandex plan versions')
  lines.push('- `/ecosystem execpolicy write` — Codex execpolicy.md')
  lines.push('- `/ecosystem config continue write` — Continue.dev fragment')
  lines.push('- `/git-commit [message]` — Aider-style commit (blinkcode: prefix)')
  lines.push('- `/sandbox-diff status|apply|discard` — Plandex-style diff review')
  lines.push('- `/interpret <lang> <code>` — Open Interpreter-style execution prompt')
  lines.push('- `/experiment new <label>` — OpenCode experiment fork + git branch')
  lines.push('- `/crush on` — Crush compact TUI output · `/aider` — Aider cheat sheet')
  lines.push('- `/reflect` — AutoGPT reflect phase · `/chain start <goal>` — full chain')
  lines.push('- `/warp preview|run` — Warp block runner · `/worktree new` — OpenHands isolation')
  lines.push('- `/recipe next` — advance active Goose recipe step')
  lines.push('- `/ecosystem coverage` — audit all 14 upstream repos')
  lines.push('- `/codex` · `/gemini` · `/goose` · `/plandex` · `/opencode` · `/continue-dev` · `/claude-code` — per-repo help')
  return lines.join('\n')
}
