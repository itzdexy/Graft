# Tovyr Remediation Baseline

**Branch:** current working tree (Quality Program Waves 1–4)
**Date:** 2026-08-04

## Current validation commands

| Command | Result | Notes |
|---|---|---|
| `node bin/tovyr.js --version` | ✅ expected | `1.3.6 (Tovyr)` |
| `bun install --frozen-lockfile` | ✅ expected | Lockfile stable |
| `npm run typecheck` | ❌ deferred | Large pre-existing TS surface; not a Wave 1–4 blocker |
| `npm run lint` | ✅ CI gate | Biome; `packages/tovyrroute` excluded |
| `npm run check:brand` | ✅ CI gate | User-facing brand strings |
| `bun test` | ✅ CI gate | `services/tovyr`, `components/tovyr`, related units |
| `node scripts/publish-npm.js --dry-run` | ✅ CI gate | Version rewritten from `TOVYR_VERSION` |

## Resolved (Quality Program)

- Stream idle watchdog default **120s**; `TOVYR_STREAM_IDLE_TIMEOUT_MS` maps to `CLAUDE_STREAM_IDLE_TIMEOUT_MS`.
- Ask/`default` mode auto-allows Write/Edit in the working tree (matches tiers + product preference).
- User-facing `kairo` leftovers cleared (system prompt, Chrome extension, chrome command); `services/kairo/**` untracked.
- Local test artifacts untracked; `.gitignore` tightened.
- Ambient sky animates; design tokens adopted in dashboard/boot; spacing tests aligned.
- Warm fingerprint covers `services/tovyr`, `entrypoints`, `screens`, `components/tovyr`.
- Provider probe no longer poisons model availability on timeouts.
- TovyrWeb rejects nonsense bare-phrase URLs.
- Telemetry/feedback/metrics endpoints hard-gated behind opt-in (`TOVYR_CODE_ENABLE_TELEMETRY=1`).
- The legacy Chrome extension and native-host integration have been removed.
- CI runs lint + brand check + tests + smoke + publish dry-run.

## Remaining (follow-on)

- Full `tsc` cleanup (~1895 errors) as a dedicated tsconfig epic.
- Optional gitleaks historical secret scan before public push.
- Further OAuth constant isolation for Anthropic console URLs (FreeModel key flow is the supported path).
- Legacy `~/.claude` UI strings in bundled skills/permission dialogs (low visibility).

## Privacy

Default privacy level is `no-telemetry`. Opt in with `TOVYR_CODE_ENABLE_TELEMETRY=1`. `tovyr doctor` reports the active privacy level.
