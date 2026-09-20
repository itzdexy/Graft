import type { EcosystemUpstream, EcosystemUpstreamId } from './types.js'

/** Open-source coding agents ported / adapted into Graft. */
export const ECOSYSTEM_UPSTREAMS: EcosystemUpstream[] = [
  {
    id: 'claude-code',
    name: 'Graft',
    repo: 'https://github.com/Dexyy2/Graft-code-cli',
    license: 'MIT',
    stars: 'N/A',
    summary: 'Agentic terminal IDE — Graft is built on this stack.',
    features: [
      {
        id: 'slash-commands',
        label: 'Slash commands & skills',
        summary: 'Plugin skills, MCP, forked subagents.',
        graftHook: '/skills',
        impl: 'commands/',
      },
      {
        id: 'plan-code',
        label: 'Plan / code modes',
        summary: 'Structured plan-then-implement workflow.',
        graftHook: '/plan · /code',
      },
      {
        id: 'subagents',
        label: 'Subagents & hooks',
        summary: 'Forked agents, compaction, automation hooks.',
        graftHook: '/agent · /hooks',
        impl: 'commands/graft/agent.ts',
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
    features: [
      {
        id: 'approval-modes',
        label: 'Approval modes',
        summary: 'Suggest / auto / full-auto tool policies.',
        graftHook: '/mode',
        impl: 'services/graft/ecosystem/adapters/codex.ts',
      },
      {
        id: 'agents-md',
        label: 'AGENTS.md context',
        summary: 'Project agent instructions file.',
        graftHook: '/agents-md init',
        impl: 'services/graft/context/agentsMd.ts',
      },
      {
        id: 'execpolicy',
        label: 'execpolicy.md',
        summary: 'Document shell/tool approval policy.',
        graftHook: '/ecosystem execpolicy write',
        impl: 'services/graft/ecosystem/codex/execPolicy.ts',
      },
    ],
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    repo: 'https://github.com/google-gemini/gemini-cli',
    license: 'Apache-2.0',
    summary: 'Gemini in the terminal — @file context and grounding.',
    features: [
      {
        id: 'at-files',
        label: '@file context',
        summary: 'Expand @paths into prompt attachments.',
        graftHook: '@ in prompt (auto-enrich)',
        impl: 'services/graft/ecosystem/prompt/enrich.ts',
      },
      {
        id: 'mcp',
        label: 'MCP tools',
        summary: 'Model Context Protocol integrations.',
        graftHook: '/mcp',
      },
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    repo: 'https://github.com/anomalyco/opencode',
    license: 'MIT',
    summary: 'Multi-model open agent with session forking.',
    features: [
      {
        id: 'session-fork',
        label: 'Session fork metadata',
        summary: 'Branch conversations for experiments.',
        graftHook: '/experiment new',
        impl: 'services/graft/ecosystem/opencode/forkStore.ts',
      },
      {
        id: 'lsp',
        label: 'LSP context',
        summary: 'Language-server aware edits.',
        graftHook: 'ENABLE_LSP_TOOL + /repo analyze',
        impl: 'services/graft/lsp/lspContext.ts',
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
    features: [
      {
        id: 'search-replace',
        label: 'SEARCH/REPLACE blocks',
        summary: 'Aider-style edit markers in tool output.',
        graftHook: '/aider format',
        impl: 'services/graft/edits/aiderBlocks.ts',
      },
      {
        id: 'repo-map',
        label: 'Repo map',
        summary: 'Ranked symbol map for context.',
        graftHook: '/repo graph',
        impl: 'services/graft/repo/repoMap.ts',
      },
      {
        id: 'git-commit',
        label: 'Auto git commit',
        summary: 'Commit after edits with graftcode: prefix.',
        graftHook: '/git-commit',
        impl: 'services/graft/git/checkpoint.ts',
      },
      {
        id: 'lint-hint',
        label: 'Post-edit lint hint',
        summary: 'Suggest test/lint after edits (auto-verify).',
        graftHook: '/aider lint',
        impl: 'services/graft/ecosystem/lint/suggestLint.ts',
      },
      {
        id: 'aider-cmd',
        label: 'Aider cheat sheet',
        summary: 'SEARCH/REPLACE, map, lint in one place.',
        graftHook: '/aider',
        impl: 'services/graft/ecosystem/adapters/aider.ts',
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
    features: [
      {
        id: 'recipes',
        label: 'Recipes',
        summary: 'Multi-step scripted workflows.',
        graftHook: '/recipe',
        impl: 'services/graft/ecosystem/recipes/gooseRecipes.ts',
      },
      {
        id: 'mcp-extensions',
        label: 'MCP extensions',
        summary: 'Compose MCP tools before shell one-offs.',
        graftHook: '/mcp',
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
    features: [
      {
        id: 'issue-resolver',
        label: 'Issue resolver',
        summary: 'GitHub issue → patch workflow prompt.',
        graftHook: '/resolve-issue',
        impl: 'services/graft/ecosystem/adapters/openhands.ts',
      },
      {
        id: 'worktree',
        label: 'Git worktree isolation',
        summary: 'Sandbox fixes in a linked worktree.',
        graftHook: '/worktree new',
        impl: 'services/graft/ecosystem/openhands/worktree.ts',
      },
    ],
  },
  {
    id: 'crush',
    name: 'Crush',
    repo: 'https://github.com/charmbracelet/crush',
    license: 'MIT',
    summary: 'Charm terminal agent — keyboard-first TUI patterns.',
    features: [
      {
        id: 'tui-shortcuts',
        label: 'TUI shortcuts',
        summary: 'Crush-style keybinding hints for Graft REPL.',
        graftHook: '/crush shortcuts',
        impl: 'services/graft/ecosystem/adapters/crush.ts',
      },
      {
        id: 'compact-mode',
        label: 'Compact output',
        summary: 'Bullet-short replies; footer crush badge.',
        graftHook: '/crush on',
        impl: 'services/graft/ecosystem/crush/state.ts',
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
    features: [
      {
        id: 'diff-sandbox',
        label: 'Diff sandbox',
        summary: 'Review AI edits before applying to tree.',
        graftHook: '/sandbox-diff',
        impl: 'services/graft/ecosystem/sandbox/diffReview.ts',
      },
      {
        id: 'superthink',
        label: 'Phased plan → build',
        summary: 'Research, Q&A, plan approval, build.',
        graftHook: '/superthink',
        impl: 'services/graft/superthink/',
      },
      {
        id: 'plan-versions',
        label: 'Plan version branches',
        summary: 'Snapshot graftplan.md variants per goal.',
        graftHook: '/ecosystem plan save',
        impl: 'services/graft/ecosystem/sandbox/planVersions.ts',
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
    features: [
      {
        id: 'config-fragment',
        label: 'config.yaml fragment',
        summary: 'Export Continue-compatible rules snippet.',
        graftHook: '/ecosystem config continue',
        impl: 'services/graft/ecosystem/adapters/continue-dev.ts',
      },
      {
        id: 'rules-sync',
        label: 'Rules sync',
        summary: 'Mirror AGENTS.md into .continue/rules/graft.md.',
        graftHook: '/ecosystem config continue rules',
        impl: 'services/graft/ecosystem/continue/syncRules.ts',
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
    features: [
      {
        id: 'templates',
        label: 'Project templates',
        summary: 'Scaffold prompts for greenfield apps.',
        graftHook: '/ecosystem template',
        impl: 'services/graft/ecosystem/adapters/gpt-engineer.ts',
      },
      {
        id: 'improve',
        label: 'Improve mode (-i)',
        summary: 'Iterate on existing codebase without rescaffold.',
        graftHook: '/improve',
        impl: 'services/graft/ecosystem/adapters/gpt-engineer.ts',
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
    features: [
      {
        id: 'agent-chain',
        label: 'Agent chain',
        summary: 'Think → plan → act → reflect loop.',
        graftHook: '/agent start',
        impl: 'services/graft/agent/',
      },
      {
        id: 'reflect',
        label: 'Reflect step',
        summary: 'Explicit reflect phase prompt.',
        graftHook: '/reflect',
        impl: 'services/graft/ecosystem/adapters/autogpt.ts',
      },
      {
        id: 'chain',
        label: 'Full agent chain',
        summary: 'Analyze → plan → act → reflect in one flow.',
        graftHook: '/chain start',
        impl: 'commands/graft/chain.impl.ts',
      },
    ],
  },
  {
    id: 'warp',
    name: 'Warp',
    repo: 'https://github.com/warpdotdev/Warp',
    license: 'Proprietary',
    summary: 'Block-based terminal — command block parsing.',
    features: [
      {
        id: 'command-blocks',
        label: 'Command blocks',
        summary: 'Parse multi-command paste into steps.',
        graftHook: '/warp preview',
        impl: 'services/graft/ecosystem/adapters/warp.ts',
      },
      {
        id: 'block-runner',
        label: 'Block runner',
        summary: 'Execute Warp blocks in order via agent.',
        graftHook: '/warp run',
        impl: 'services/graft/ecosystem/warp/runBlocks.ts',
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
    features: [
      {
        id: 'interpret',
        label: 'Interpret mode',
        summary: 'Run Python/JS in sandboxed Bash with guardrails.',
        graftHook: '/interpret',
        impl: 'services/graft/ecosystem/adapters/openinterpreter.ts',
      },
      {
        id: 'guardrails',
        label: 'Execution guardrails',
        summary: 'Retry-once, no network unless asked.',
        graftHook: '/interpret',
        impl: 'services/graft/ecosystem/adapters/openinterpreter.ts',
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
    '# Graft ecosystem',
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
      const hook = f.graftHook ? ` → \`${f.graftHook}\`` : ''
      lines.push(`- **${f.label}** — ${f.summary}${hook}`)
    }
    lines.push('')
  }
  lines.push('## Commands')
  lines.push('- `/ecosystem` — this catalog · `/ecosystem status` — active toggles')
  lines.push('- `/recipe list|run <id>|start <id>` — Goose-style workflows (start auto-runs step 1)')
  lines.push('- `/improve [goal]` — gpt-engineer improve mode (-i)')
  lines.push('- `/resolve-issue <url>` — OpenHands issue workflow')
  lines.push('- `/agents-md init|show` — AGENTS.md template')
  lines.push('- `/ecosystem plan save|list` — Plandex plan versions')
  lines.push('- `/ecosystem execpolicy write` — Codex execpolicy.md')
  lines.push('- `/ecosystem config continue write` — Continue.dev fragment')
  lines.push('- `/git-commit [message]` — Aider-style commit (graftcode: prefix)')
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
