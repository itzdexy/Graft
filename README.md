# Tovyr

**v2.00.5** — AI coding agent in your terminal, powered by [FreeModel](https://freemodel.dev) and 20+ compatible providers.

This npm package installs the **global Tovyr launcher** with multi-provider auth. For the full Tovyr UI (agents, buddy, `/provider`, auto-verify), clone the [GitHub repo](https://github.com/itsdexy/Tovyr) and run from source with Bun.

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

## Full source install (recommended)

```bash
git clone https://github.com/itsdexy/Tovyr.git
cd TovyrCode
npm install
npm run build
npm install -g .
```

Requires [Bun](https://bun.sh). Unlocks `/agent`, `/provider`, `/buddy`, auto-verify, and all Tovyr slash commands.

## Performance (Windows)

First `tovyr` launch can take **1–3 minutes** while Bun compiles the app — that is not the model being slow. Pre-warm once per session:

```bash
npm run warm
```

Run `tovyr` from a **project folder**, not your home directory.

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
| `TOVYR_STREAM_IDLE_TIMEOUT_MS` | Abort hung streams (120000 ms via `tovyr` launcher; 90000 ms otherwise) |

## Notes

- Do **not** use `/login` inside the app — use `tovyr auth login` or `/provider` instead.
- Keys are stored in `~/.tovyr/` on your machine, never in this package.
- After updating, run `tovyr` once to verify the launcher and UI branding.

## License

MIT. Unofficial wrapper for personal use with FreeModel and compatible gateways.
