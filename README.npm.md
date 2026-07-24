# Blink

**v2.00.5** — AI coding agent in your terminal, powered by [FreeModel](https://freemodel.dev) and 20+ compatible providers.

This npm package installs the **global Blink launcher** with multi-provider auth. For the full Blink UI (agents, buddy, `/provider`, auto-verify), clone the [GitHub repo](https://github.com/itsdexy/BlinkCode) and run from source with Bun.

## Install

```bash
npm install -g blinkcode
```

On Windows, open a **new** terminal after install, then:

```powershell
blink --version
```

**Important:** Run `blink` inside a **project folder**, not your home directory. Launching from home is slow and scans your entire user profile.

```powershell
cd path\to\your-project
blink
```

If install scripts were blocked, approve them:

```powershell
npm approve-scripts blinkcode
```

## Quick start

1. Get an API key from [freemodel.dev](https://freemodel.dev) (`fe_oa_...`) or another supported provider.

2. Save your key:

```bash
blink auth login --key fe_oa_YOUR_KEY_HERE
```

3. Run in any project folder:

```bash
blink
```

## Commands

| Command | Description |
|---------|-------------|
| `blink` | Start the agent |
| `blink --fast` | Faster startup (minimal plugins) |
| `blink --version` | Show version |
| `blink auth login --key <key>` | Save API key |
| `blink provider list` | List providers / active model |
| `blink provider use <id>` | Switch provider |
| `blink setup` | Verify install + API key |

Also available as `blinkcode` — same binary.

## Web tools

Built-in **WebSearch**, **WebFetch**, and **BlinkWeb** work without a browser extension.

## Full source install (recommended)

```bash
git clone https://github.com/itsdexy/BlinkCode.git
cd BlinkCode
npm install
npm run build
npm install -g .
```

Requires [Bun](https://bun.sh). Unlocks `/agent`, `/provider`, `/buddy`, auto-verify, and all Blink slash commands.

## Performance (Windows)

First `blink` launch can take **1–3 minutes** while Bun compiles the app — that is not the model being slow. Pre-warm once per session:

```bash
npm run warm
```

Run `blink` from a **project folder**, not your home directory.

## Documentation

Full feature guide: [docs/GUIDE.md](docs/GUIDE.md) (slash commands, providers, modes, troubleshooting).

## Environment

| Variable | Description |
|----------|-------------|
| `BLINK_API_KEY` | API key (alternative to `auth login`) |
| `BLINK_PROVIDER_BASE_URL` | API base URL override |
| `BLINK_DEFAULT_MODEL` | Default model override |
| `BLINK_AUTO_FAILOVER` | `1` = switch provider on hard failures |
| `BLINK_IMPLEMENTATION_GUARD` | On by default; set `0` to disable extra build-request nudges |
| `BLINK_STREAM_IDLE_TIMEOUT_MS` | Abort hung streams (120000 ms via `blink` launcher; 90000 ms otherwise) |

## Notes

- Do **not** use `/login` inside the app — use `blink auth login` or `/provider` instead.
- Keys are stored in `~/.blink/` on your machine, never in this package.
- After updating, run `blink` once to verify the launcher and UI branding.

## License

MIT. Unofficial wrapper for personal use with FreeModel and compatible gateways.
