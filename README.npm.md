# Tovyr

**v1.2.0** — AI coding agent in your terminal, powered by [FreeModel](https://freemodel.dev) and compatible providers.

The npm package includes Tovyr's complete Bun runtime: the terminal UI, Buddy, provider/model selection, streaming chat, tools, and verification. It does not install or launch another AI terminal.

## Install

```bash
npm install -g tovyr
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
npm approve-scripts tovyr
```

## Quick start

1. Install [Ollama](https://ollama.com), then download the default local model:

```bash
ollama pull qwen2.5-coder:1.5b
```

2. Run Tovyr—no account, login, or API key is required:

```bash
tovyr
```

3. Optional cloud models can be connected later:

```bash
tovyr auth login --key fe_oa_YOUR_KEY_HERE
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
| `tovyr setup` | Verify the local runtime and optional provider configuration |

The `tovyrcode` binary name still works — same launcher. The package was
published as `tovyrcode` before v1.3.7.

## Web tools

Built-in **WebSearch**, **WebFetch**, and **TovyrWeb** work without a browser extension.

## Full source install (recommended)

```bash
git clone https://github.com/itzdexy/Tovyr.git
cd TovyrCode
npm install
npm run build
npm install -g .
```

Requires [Bun](https://bun.sh). Unlocks `/agent`, `/provider`, `/buddy`, auto-verify, and all Tovyr slash commands.

The source application lives under `src/`; its Bun entrypoint is
`src/entrypoints/cli.tsx`. Repository provenance and third-party licensing
context are documented in `NOTICE`.

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
| `TOVYR_STREAM_IDLE_TIMEOUT_MS` | Abort hung streams after idle ms (default `120000`; maps to `CLAUDE_STREAM_IDLE_TIMEOUT_MS`) |

## Notes

- Do **not** use `/login` inside the app — use `tovyr auth login` or `/provider` instead.
- Keys are stored in `~/.tovyr/` on your machine, never in this package.
- After updating, run `tovyr` once to verify the launcher and UI branding.

## License

MIT. Unofficial wrapper for personal use with FreeModel and compatible gateways.
