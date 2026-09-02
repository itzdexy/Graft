# Tovyr

**v1.3.6** — AI coding agent in your terminal, powered by [FreeModel](https://freemodel.dev) and 20+ compatible providers.

This npm package installs the **global Tovyr launcher** with multi-provider auth. For the full Tovyr UI (agents, buddy, `/provider`, auto-verify), clone the [GitHub repo](https://github.com/itzdexy/Tovyr) and run from source with Bun.

## Install

```bash
npm install -g tovyrcode
```

On Windows, open a **new** terminal after install, then:

```powershell
tovyr --version
```

**Important:** Run `tovyr` inside a **project folder**, not your home directory. Launching from home is slow and scans your entire user profile.

```powershell
cd path\to\your-project
tovyr
```

If install scripts were blocked, approve them:

```powershell
npm approve-scripts tovyrcode
```

## Quick start

1. Get an API key from [freemodel.dev](https://freemodel.dev) (`fe_oa_...`) or another supported provider.

2. Save your key:

```bash
tovyr auth login --key fe_oa_YOUR_KEY_HERE
```

3. Run in any project folder:

```bash
tovyr
```

## Commands

| Command | Description |
|---------|-------------|
| `tovyr` | Start the agent |
| `tovyr --fast` | Faster startup (minimal plugins) |
| `tovyr --version` | Show version |
| `tovyr auth login --key <key>` | Save API key |
| `tovyr provider list` | List providers / active model |
| `tovyr provider use <id>` | Switch provider |
| `tovyr setup` | Verify install + API key |

Also available as `tovyrcode` — same binary.

## Web tools

Built-in **WebSearch**, **WebFetch**, and **TovyrWeb** work without a browser extension. Use `/browser` for research-style browsing when configured.

## Agent harness

- `/auto` enables classifier-guarded autonomy for supported agentic models. Routine workspace edits and commands can proceed; destructive operations, secrets, unusual shell actions, and remote messages still require approval.
- Named subagents can work in the background, receive follow-up messages, and resume from their transcript.
- `/peers` lists other live local Tovyr sessions. Agents use `ListPeers`, then `SendMessage` with the returned `uds:` address to collaborate across sessions.
- Ready Fable-family models are preferred for planning, while ready Opus-family models are preferred for implementation. Verification uses another ready model when possible.

Local session messages use a bounded named pipe on Windows or Unix socket on macOS/Linux. They never carry provider credentials or permission approvals.

## Full source install (recommended)

```bash
git clone https://github.com/itzdexy/Tovyr.git
cd Tovyr
bun install
bun run build
npm install -g .
```

Requires [Bun](https://bun.sh). Unlocks `/agent`, `/provider`, `/buddy`, auto-verify, and all Tovyr slash commands.

## Repository layout

| Path | Purpose |
|------|---------|
| `src/` | Bun/TypeScript application and co-located tests |
| `src/entrypoints/cli.tsx` | Source CLI entrypoint |
| `bin/` | Cross-platform launchers |
| `scripts/` | Build, release, and repository checks |
| `docs/` | User and contributor documentation |
| `vendor/` | Explicit compatibility shims and third-party boundaries |

Run `npm run check:layout` to catch generated artifacts or application folders
that accidentally return to the repository root.

## Platform support

Tovyr follows the executable targets published by Bun:

| Platform | Architectures | Notes |
|----------|---------------|-------|
| Windows 10 1809+ | x64, ARM64 | PowerShell 5.1+ launcher |
| macOS 13+ | Intel x64, Apple Silicon ARM64 | Bash/zsh launcher |
| Linux | x64, ARM64 | glibc 2.17+ or musl |
| Termux | x64, ARM64 | Run `pkg install glibc patchelf` first |

There is no Bun runtime for 32-bit x86 (`ia32`), so Tovyr reports that
configuration as unsupported instead of downloading or launching a mismatched
binary. Run `tovyr doctor` to see the detected target and compatibility notes.

## Performance (Windows)

First `tovyr` launch can take **1–3 minutes** while Bun compiles the app — that is not the model being slow. Pre-warm once per session:

```bash
npm run warm
```

Run `tovyr` from a **project folder**, not your home directory.

Tovyr does not force Bun garbage collection during active runs. Long-running interactive sessions sample heap pressure every 30 seconds and may request one full collection only after the session has been idle for at least 30 seconds; collections are then rate-limited for five minutes.

## Documentation

Full feature guide: [docs/GUIDE.md](docs/GUIDE.md) (slash commands, providers, modes, troubleshooting).

## Environment

| Variable | Description |
|----------|-------------|
| `TOVYR_API_KEY` | API key (alternative to `auth login`) |
| `TOVYR_PROVIDER_BASE_URL` | API base URL override |
| `TOVYR_DEFAULT_MODEL` | Default model override |
| `TOVYR_AUTO_FAILOVER` | `1` = switch provider on hard failures |
| `TOVYR_IMPLEMENTATION_GUARD` | On by default; set `0` to disable extra build-request nudges |
| `TOVYR_FIRST_RESPONSE_TIMEOUT_MS` | Stop a model that sends no response event (default `30000`; `0` disables) |
| `TOVYR_STREAM_IDLE_TIMEOUT_MS` | Abort a stream that starts and then goes idle (default `45000`; maps to `CLAUDE_STREAM_IDLE_TIMEOUT_MS`) |

## Notes

- Do **not** use `/login` inside the app — use `tovyr auth login` or `/provider` instead.
- Keys are stored in `~/.tovyr/` on your machine, never in this package.
- After updating, run `tovyr` once to verify the launcher and UI branding.

## License

MIT. See [NOTICE](NOTICE) for provenance and third-party licensing context.
