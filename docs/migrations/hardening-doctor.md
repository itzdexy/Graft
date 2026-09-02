# Hardening: `tovyr doctor` improvements

## What changed

- `tovyr-doctor.js` now supports `--export` to write a JSON report.
- New checks added:
  - `Config directory writable` — ensures `~/.tovyr` can be created and written.
  - `Disk space` — reports free space on the home / project drive.
  - `Browser dependencies` — detects Playwright/MCP availability.
  - `MCP configuration` — lists MCP server sources (user, project, global settings).
- `scripts/tovyr-cli-ux.js` now parses `--export` and exposes `isExportMode()`.
- `printDoctorHelp()` documents `--export` and the new checks.
- `main.tsx` program name is `tovyr` and `mcp add-from-claude-desktop` renamed to `mcp add-from-tovyr-desktop` with a legacy alias.
- `validateProviderModel.test.ts` updated to match the current `nvidia_nim` catalog default.

## Validation

- `bun test services/tovyr/launcherStartupContract.test.ts` — 13 pass, 0 fail.
- `bun test services/tovyr/validateProviderModel.test.ts` — 3 pass, 0 fail.
- `bun test scripts/tovyr-cli.integration.test.ts` — 31 pass, 0 fail.
- `bun test` — 0 fail (full suite).
- `bun run lint` — clean.
- `bun run typecheck` — pre-existing errors unrelated to this pass.
- `node scripts/tovyr-doctor.js --export` — writes a JSON report and exits 0.
