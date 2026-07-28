# Tovyr — Deployment Guide

This document is for **shipping and operating** Tovyr in production-like environments.

## User documentation

See **[docs/GUIDE.md](GUIDE.md)** for installation, providers, config format, commands, workflows, safety, and contributor guides (add provider / tool / agent).

## Two install shapes

| Shape | Who | Runtime | Features |
|-------|-----|---------|----------|
| **npm global** (`tovyrcode`) | End users | Node 18+ | Tovyr launcher + multi-provider auth |
| **Source checkout** | Contributors / full UI | **Bun** + Node | Ink REPL, `/provider`, `/model`, agents, Tovyr branding |

The npm package does **not** include `entrypoints/cli.tsx`. Users who expect the full Tovyr TUI must clone the repo, install Bun, run `npm run warm`, and `npm install -g .`.

## Source deployment checklist

```bash
git clone https://github.com/itsdexy/Tovyr.git
cd TovyrCode
bun install --frozen-lockfile   # or npm install after Bun is on PATH
npm run warm                    # pre-compile (~1–3 min first time)
npm test
npm install -g .
```

Verify:

```bash
tovyr setup
tovyr --version
cd your-project && tovyr
```

## Environment variables (production)

| Variable | Purpose |
|----------|---------|
| `TOVYR_API_KEY` | Provider API key |
| `TOVYR_AUTO_FAILOVER` | `1` = retry on model/provider hard failures |
| `TOVYR_PROXY_DEBUG` | `1` = log OpenAI-compat proxy to `.tovyr/proxy-debug.log` |
| `TOVYR_SKIP_WARM` | `1` = skip compile warm (slower cold start) |
| `TOVYR_STRICT_WARM` | `1` = fail launch if warm compile fails |
| `TOVYR_COMMENT_TASKS` | `1` = scan repo for TODO/TOVYR comments on short prompts (slower) |
| `TOVYR_CODE_SIMPLE` | Set by default (`--bare`) for fast startup |

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

- Ubuntu + Windows: `npm test` (Tovyr services, live activity UI guard, Windows/input tests)
- Smoke: `bun run entrypoints/cli.tsx --version`, `node bin/tovyr.js --version`
- Doctor: `node scripts/tovyr-doctor.js` (Windows)

## npm publish

```bash
npm run publish:npm:dry-run   # validate tarball
npm run publish:npm           # swaps package.npm.json, publishes, restores
```

Published package uses `package.npm.json` (launcher-only, uses the Tovyr launcher package).

## Expansion modules (honest scope)

Many files under `agents/`, `browser/`, `cicd/`, `workflows/`, etc. are **scaffolds** surfaced via `/expansion` — they are not all wired into the main `query.ts` loop. Production agent work runs through:

- `query.ts` → `services/api/tovyr.ts`
- `tools.ts` → Bash, Read, Write, Edit, Agent, MCP
- `services/tovyr/provider.ts` → multi-provider routing

Do not assume every `/expansion` feature is production-ready without checking `services/tovyr/expansion/index.ts` status.

## Troubleshooting deploy

| Symptom | Fix |
|---------|-----|
| `bun` not found | Install Bun; set `TOVYR_BUN_CMD` to full path |
| postinstall warm fails | Run `npm run warm` manually after Bun install |
| npm users miss Tovyr UI | Point them to source install (this doc § Source deployment) |
| 2+ min first reply | GPU cold start or missing warm compile — see [GUIDE.md](./GUIDE.md) |
| Windows `tovyr` not found | New terminal; run `bin/install-tovyr.cmd` or `tovyr setup` |

## Security notes

- API keys live in `~/.tovyr/` — restrict file permissions on shared machines.
- OpenAI-compat providers use a **localhost translator**; keys are forwarded to upstream only from that proxy process.
- Use project directories, not home directory, as cwd.
