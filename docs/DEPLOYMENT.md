# Blink — Deployment Guide

This document is for **shipping and operating** Blink in production-like environments.

## User documentation

See **[docs/GUIDE.md](GUIDE.md)** for installation, providers, config format, commands, workflows, safety, and contributor guides (add provider / tool / agent).

## Two install shapes

| Shape | Who | Runtime | Features |
|-------|-----|---------|----------|
| **npm global** (`blinkcode`) | End users | Node 18+ | Blink launcher + multi-provider auth |
| **Source checkout** | Contributors / full UI | **Bun** + Node | Ink REPL, `/provider`, `/model`, agents, Blink branding |

The npm package does **not** include `entrypoints/cli.tsx`. Users who expect the full Blink TUI must clone the repo, install Bun, run `npm run warm`, and `npm install -g .`.

## Source deployment checklist

```bash
git clone https://github.com/itsdexy/BlinkCode.git
cd BlinkCode
bun install --frozen-lockfile   # or npm install after Bun is on PATH
npm run warm                    # pre-compile (~1–3 min first time)
npm test
npm install -g .
```

Verify:

```bash
blink setup
blink --version
cd your-project && blink
```

## Environment variables (production)

| Variable | Purpose |
|----------|---------|
| `BLINK_API_KEY` | Provider API key |
| `BLINK_AUTO_FAILOVER` | `1` = retry on model/provider hard failures |
| `BLINK_PROXY_DEBUG` | `1` = log OpenAI-compat proxy to `.blink/proxy-debug.log` |
| `BLINK_SKIP_WARM` | `1` = skip compile warm (slower cold start) |
| `BLINK_STRICT_WARM` | `1` = fail launch if warm compile fails |
| `BLINK_COMMENT_TASKS` | `1` = scan repo for TODO/BLINK comments on short prompts (slower) |
| `CLAUDE_CODE_SIMPLE` | Set by default (`--bare`) for fast startup |

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

- Ubuntu + Windows: `npm test` (Blink services, live activity UI guard, Windows/input tests)
- Smoke: `bun run entrypoints/cli.tsx --version`, `node bin/blink.js --version`
- Doctor: `node scripts/blink-doctor.js` (Windows)

## npm publish

```bash
npm run publish:npm:dry-run   # validate tarball
npm run publish:npm           # swaps package.npm.json, publishes, restores
```

Published package uses `package.npm.json` (launcher-only, uses the Blink launcher package).

## Expansion modules (honest scope)

Many files under `agents/`, `browser/`, `cicd/`, `workflows/`, etc. are **scaffolds** surfaced via `/expansion` — they are not all wired into the main `query.ts` loop. Production agent work runs through:

- `query.ts` → `services/api/blink.ts`
- `tools.ts` → Bash, Read, Write, Edit, Agent, MCP
- `services/blink/provider.ts` → multi-provider routing

Do not assume every `/expansion` feature is production-ready without checking `services/blink/expansion/index.ts` status.

## Troubleshooting deploy

| Symptom | Fix |
|---------|-----|
| `bun` not found | Install Bun; set `BLINK_BUN_CMD` to full path |
| postinstall warm fails | Run `npm run warm` manually after Bun install |
| npm users miss Blink UI | Point them to source install (this doc § Source deployment) |
| 2+ min first reply | GPU cold start or missing warm compile — see [GUIDE.md](./GUIDE.md) |
| Windows `blink` not found | New terminal; run `bin/install-blink.cmd` or `blink setup` |

## Security notes

- API keys live in `~/.blink/` — restrict file permissions on shared machines.
- OpenAI-compat providers use a **localhost translator**; keys are forwarded to upstream only from that proxy process.
- Use project directories, not home directory, as cwd.
