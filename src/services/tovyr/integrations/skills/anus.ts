/** Patterns inspired by ANUS CLI (Apache-2.0) — https://github.com/anus-dev/ANUS */

export const ANUS_EVOLVE_SKILL = `# ANUS-inspired agent workflow

Patterns from the ANUS (Autonomous Networked Utility System) CLI — Grok/MCP-first terminal agent.

## Project context file

- Maintain \`tovyr.md\` or \`ANUS.md\` in repo root with: goals, stack, conventions, active tasks, links.
- Read it at session start; update when architecture or priorities change.
- Tovyr supports \`tovyr.md\` and legacy compatibility memory files — prefer \`tovyr.md\` in Tovyr projects.

## MCP-first extensions

- Prefer MCP servers for browser, APIs, and external tools over ad-hoc curl in bash.
- Document new MCP capabilities in the project context file when added.

## Self-improvement loop (meta)

When user asks to improve Tovyr/the agent itself:

1. Reproduce the issue with minimal steps.
2. Propose a **small** patch with tests or verification.
3. Note what should become a skill or hook so the lesson persists.

## Grok / OpenRouter

ANUS targets \`xai/grok-code-fast-1\`. In Tovyr: \`/provider use xai\` or OpenRouter model \`xai/grok-*\` with a gateway key.

## Contribution ethos

Favor AI-generated implementations that are reviewable, tested, and minimal — not sprawling refactors.
`
