## Learned User Preferences

- Rebrand user-facing "Blink" / "Blink" strings to "Blink" / "Blink".
- Do not launch `blink.exe`; Blink must run the Bun/source CLI only.
- Run `blink` and repo commands (`npm publish`, etc.) from the project working directory, not the Windows home directory.
- `/init` should create `blink.md`, not `CLAUDE.md`.
- Plan mode drafts `blinkplan.md` in the project root; `/code` accepts and implements. Natural-language build requests ("code me…", "make me…") auto-promote to code mode so Write/Edit land files on disk.
- Bare `blink` should start the interactive agent UI; help is only via `blink --help`.
- User develops on Windows (PowerShell); global `blink` opens a clean terminal from `%USERPROFILE%\.local\bin\blink.cmd` (restart CMD after install for PATH).
- Use `/model` (not `/models`) for model selection; show only models for the active connected provider.
- Prefer `blink auth login --key` for FreeModel; avoid blink web OAuth `/login` (conflicts with API-key auth).
- Never commit or publish secrets (API keys, npm tokens, credentials) to GitHub or npm.
- Show active Blink mode in the prompt footer bottom-right (plan, code, bypass, superthink, …).
- Prefer one live activity/spinner row in chat; avoid duplicate thinking + tool-status indicators.
- Ask (default) and `/code` auto-accept Write/Edit and allowlisted shell (`git`, `gh`, `npm`, …); still prompt for unusual/destructive commands and secret paths. `/plan` stays read-only.

## Learned Workspace Facts

- `blinkcode` npm package: Blink is an AI coding agent with multi-provider / FreeModel support; GitHub repo is [itsdexy/BlinkCode](https://github.com/itsdexy/BlinkCode).
- Source entry is `entrypoints/cli.tsx` via Bun; launchers are `bin/blink.js` and `bin/blink.ps1`; plain `blink` adds `--bare` by default (`blink --full` for all plugin MCP servers).
- `query.ts` is the runtime source of truth; Blink product logic lives in `services/blink/**`.
- Multi-provider routing uses `/provider` and `/model`; provider keys live under `~/.blink/` (with legacy `~/.blink.json` auth); OpenAI-compat providers filter `/model` to verified live API models.
- Default FreeModel upstream base URL is `https://cc.freemodel.dev`.
- Provider auto-failover is off by default; enable with `BLINK_AUTO_FAILOVER=1`.
- Blink stream watchdog aborts hung model API streams after ~2 minutes by default.
- `/superthink` runs a localhost clarification Q&A flow; project toggle and sessions under `<project>/.blink/superthink/`.
- IDE integration reads `BLINK_CODE_*` env vars (with `CLAUDE_CODE_*` fallback from VS Code/Cursor).
- User-facing docs live in `docs/GUIDE.md`.
- Launcher sets `BLINK_FORCE_INTERACTIVE=1` so Ink UI works when Windows/Bun breaks `stdout.isTTY`; Windows startup warm-compiles (1–3 min first run) with early stdin capture (CONIN$ / raw-mode) before Ink loads.
- In `blink.ps1`, use `$userHome` (not read-only `$HOME`); Bun resolves from `%USERPROFILE%\.bun\bin\bun.exe`.
