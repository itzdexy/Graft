## Learned User Preferences

- Rebrand user-facing "Tovyr" / "Tovyr" strings to "Tovyr" / "Tovyr".
- Do not launch `tovyr.exe`; Tovyr must run the Bun/source CLI only.
- Run `tovyr` and repo commands (`npm publish`, etc.) from the project working directory, not the Windows home directory.
- `/init` should create `tovyr.md`, not `CLAUDE.md`.
- Plan mode drafts `tovyrplan.md` in the project root; `/code` accepts and implements. Natural-language build requests ("code me…", "make me…") auto-promote to code mode so Write/Edit land files on disk.
- Bare `tovyr` should start the interactive agent UI; help is only via `tovyr --help`.
- User develops on Windows (PowerShell); global `tovyr` opens a clean terminal from `%USERPROFILE%\.local\bin\tovyr.cmd` (restart CMD after install for PATH).
- Use `/model` (not `/models`) for model selection; show only models for the active connected provider.
- Prefer `tovyr auth login --key` for FreeModel; avoid tovyr web OAuth `/login` (conflicts with API-key auth).
- Never commit or publish secrets (API keys, npm tokens, credentials) to GitHub or npm.
- Show active Tovyr mode in the prompt footer bottom-right (plan, code, bypass, superthink, …).
- Prefer one live activity/spinner row in chat; avoid duplicate thinking + tool-status indicators.
- Ask (default) and `/code` auto-accept Write/Edit and allowlisted shell (`git`, `gh`, `npm`, …); still prompt for unusual/destructive commands and secret paths. `/plan` stays read-only.

## Learned Workspace Facts

- `tovyrcode` npm package: Tovyr is an AI coding agent with multi-provider / FreeModel support; GitHub repo is [itsdexy/Tovyr](https://github.com/itsdexy/Tovyr).
- Source entry is `entrypoints/cli.tsx` via Bun; launchers are `bin/tovyr.js` and `bin/tovyr.ps1`; plain `tovyr` adds `--bare` by default (`tovyr --full` for all plugin MCP servers).
- `query.ts` is the runtime source of truth; Tovyr product logic lives in `services/tovyr/**`.
- Multi-provider routing uses `/provider` and `/model`; provider keys live under `~/.tovyr/` (with legacy `~/.tovyr.json` auth); OpenAI-compat providers filter `/model` to verified live API models.
- Default FreeModel upstream base URL is `https://cc.freemodel.dev`.
- Provider auto-failover is off by default; enable with `TOVYR_AUTO_FAILOVER=1`.
- Tovyr stream watchdog aborts hung model API streams after ~2 minutes by default.
- `/superthink` runs a localhost clarification Q&A flow; project toggle and sessions under `<project>/.tovyr/superthink/`.
- IDE integration reads `TOVYR_CODE_*` env vars (with `TOVYR_CODE_*` fallback from VS Code/Cursor).
- User-facing docs live in `docs/GUIDE.md`.
- Launcher sets `TOVYR_FORCE_INTERACTIVE=1` so Ink UI works when Windows/Bun breaks `stdout.isTTY`; Windows startup warm-compiles (1–3 min first run) with early stdin capture (CONIN$ / raw-mode) before Ink loads.
- In `tovyr.ps1`, use `$userHome` (not read-only `$HOME`); Bun resolves from `%USERPROFILE%\.bun\bin\bun.exe`.
