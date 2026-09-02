export function buildOpenHandsIssueResolverPrompt(issue: {
  number: number
  title: string
  body: string
  repo?: string
}): string {
  return [
    '# OpenHands-style issue resolver',
    '',
    `Resolve GitHub issue #${issue.number}: ${issue.title}`,
    issue.repo ? `Repo: ${issue.repo}` : '',
    '',
    '## Issue body',
    issue.body.trim() || '(no description)',
    '',
    '## Workflow',
    '1. Reproduce or locate relevant code (`/repo search`, Grep).',
    '2. Implement minimal fix with tests if the repo has them.',
    '3. Run `/verify` (test/lint/build).',
    '4. Summarize root cause and fix for a PR description.',
    '5. Optionally `/git-commit` with a clear message.',
    '6. For isolation: `/worktree new <name>` before large fixes.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatOpenHandsHelp(): string {
  return [
    '# OpenHands patterns',
    '',
    'Sandboxed dev agent — issue resolver and git worktree isolation.',
    '',
    '## Commands',
    '- `/resolve-issue <github-url>` — reproduce → fix → verify → PR summary',
    '- `/worktree new <name>` — linked worktree for isolated fixes',
    '',
    '## Auto-enrich',
    'GitHub issue URLs in plain prompts route to the resolver workflow.',
    '',
    '## Agent server & SDK',
    '- `/expansion serve` — HTTP agent server on :9477',
    '- `agents/AgentSDK.ts` — programmatic `runAgent()` when registered',
    '',
    '## Theory of mind',
    'Session goals and verbosity inferred automatically (see expansion prompt enrichment).',
    '',
    '## Workflow',
    buildOpenHandsIssueResolverPrompt({
      number: 0,
      title: '(example)',
      body: 'Paste a real issue URL with `/resolve-issue`.',
    }),
  ].join('\n')
}
