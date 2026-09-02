# Tovyr — User Guide

Complete guide for installing, configuring, and using **Tovyr v1.3.6**. This document reflects **what is implemented today** in this repository.

---

## Table of contents

1. [What Tovyr does](#what-tovyr-does)
2. [Installation](#installation)
3. [Quickstart](#quickstart)
4. [API keys and providers](#api-keys-and-providers)
5. [Supported models](#supported-models)
6. [Configuration files](#configuration-files)
7. [Commands and examples](#commands-and-examples)
8. [Common workflows](#common-workflows)
9. [Safety features](#safety-features)
10. [Troubleshooting](#troubleshooting)
11. [Development setup](#development-setup)
12. [How to add a provider](#how-to-add-a-provider)
13. [How to add a tool](#how-to-add-a-tool)
14. [How to add an agent](#how-to-add-an-agent)

---

## What Tovyr does

Tovyr is an **AI coding agent in your terminal**. You work in a project directory; Tovyr:

- **Reads** files and searches the codebase (Read, Grep, Glob)
- **Edits** files with diff-aware patches (Edit, Write)
- **Runs** shell commands (Bash; PowerShell on Windows when enabled)
- **Plans** work in plan mode (`/plan` → `tovyrplan.md`)
- **Runs multi-step goals** via `/agent` (optional autonomous loop with verify/autofix)

Architecture (simplified):

```
Your prompt
  → REPL (Ink TUI) or print mode (-p)
  → QueryEngine (tool loop, permissions, compaction)
  → Provider API (native or OpenAI-compat local proxy)
  → Tool calls (Read, Bash, Edit, …)
```

**Launcher vs full UI**

| Layer | Entry | Purpose |
|-------|-------|---------|
| **npm launcher** | `bin/tovyr.js` | Fast commands, auth routing, and Bun runtime launch |
| **Full CLI** | `runtime/cli.js` in npm; `src/entrypoints/cli.tsx` from source | Interactive REPL, Buddy, providers, models, tools, and streaming |

The npm package includes the complete bundled Tovyr UI. Source checkouts run the TypeScript entry directly; both paths use Bun and remain independent from other AI terminals.

---

## Installation

### Requirements

| Component | npm install | Source install |
|-----------|-------------|----------------|
| Node.js | 18+ | 18+ |
| Bun | **Required** | **Required** |
| OS | Windows, macOS, Linux | Same |

### npm global

```bash
npm install -g tovyrcode
```

On Windows, open a **new** terminal so `tovyr` is on PATH. If not found, run `bin\install-tovyr.cmd` from a source checkout.

### Source (recommended)

```bash
git clone https://github.com/itzdexy/Tovyr.git
cd Tovyr
npm install
npm run warm
npm install -g .
tovyr setup
```

`npm run warm` pre-compiles the UI so the first interactive launch takes seconds instead of minutes (especially on Windows).

---

## Quickstart

```bash
# 1. First-run checks
tovyr setup

# 2. Authenticate (FreeModel example)
tovyr auth login --key fe_oa_YOUR_KEY_HERE

# 3. Confirm configuration
tovyr config

# 4. Start in a project folder
cd path/to/your-project
tovyr
```

**Do not** run `tovyr` from your home directory — the launcher blocks this by default. Use `cd` into a project first, or `tovyr --allow-home` (not recommended).

**Print mode** (scripting, no TUI):

```bash
tovyr ask "what does this repo do?"
tovyr -p "list all TODO comments" --output-format json
```

---

## API keys and providers

Tovyr starts in free local mode with Ollama. This path needs no account,
login, API key, or cloud subscription:

```bash
ollama serve
ollama pull qwen2.5-coder:1.5b
tovyr
```

Cloud providers are optional. Their own authentication and usage policies
apply only after the user explicitly selects one with `/provider`.

Tovyr treats provider configuration and provider health as separate facts. A
successful models-list request proves that credentials can reach the provider;
it does not prove that the selected model can stream a response.

Useful checks:

```text
/provider              connect or switch a provider
/provider test         run a bounded selected-model streaming probe
/model                 choose from the active provider's available models
/model test            probe the selected model
/doctor provider       show latency, stream/tool support, quota, and safe errors
```

Connection status is shown beside the active model as `Checking`, `Ready`,
`Limited`, `Degraded`, `Invalid`, or `Offline`. Tovyr never silently switches
providers for authentication or quota failures.

### Saving keys

```bash
# Optional FreeModel cloud provider
tovyr auth login --key fe_oa_YOUR_KEY

# Named provider
tovyr auth login --provider freemodel --key fe_oa_YOUR_KEY
tovyr auth login --provider openrouter --key sk-or-YOUR_KEY
```

Keys are stored under `~/.tovyr/` on your machine (never in the npm package).

### Switching providers

```bash
tovyr provider list
tovyr provider use openrouter
tovyr provider model tovyr/sonnet
tovyr models                    # models for active provider
tovyr models ollama             # models for a specific provider
```

In the TUI: `/provider use <id>` and `/model`.

### Provider categories

Run `tovyr provider list` for the live catalog. Major groups:

| Category | Examples | API key? |
|----------|----------|----------|
| **Official** | FreeModel, Tovyr Direct | Yes |
| **Gateway** | OpenRouter, Portkey, LiteLLM | Yes |
| **API** | Google (via gateway), xAI, Mistral, Groq, … | Yes |
| **Self-hosted** | Ollama, LM Studio, Custom endpoint | Ollama/LM Studio: no |
| **Cloud** | AWS Bedrock, Azure, Vertex (via compat URL) | Yes |

### Local providers (no cloud key)

```bash
# Ollama — start server first: ollama serve
tovyr provider use ollama
tovyr provider model llama3.2

# LM Studio — start local server on port 1234
tovyr provider use lmstudio
tovyr provider model <model-id-from-lm-studio>
```

### OpenAI and Gemini (honest status)

- **Native `api.openai.com`** is **not** directly supported (OpenAI-format only; Tovyr needs tool-calling via its proxy).
- Use **OpenRouter**, **Portkey**, **LiteLLM**, or another gateway: `tovyr provider use openrouter`.
- **Gemini**: use OpenRouter/Portkey model ids (`google/gemini-…`) or point the `google` / `custom` provider at a Vertex-compatible gateway URL.

### Environment overrides

| Variable | Purpose |
|----------|---------|
| `TOVYR_API_KEY` | API key (alternative to `auth login`) |
| `TOVYR_PROVIDER_BASE_URL` | Override API base URL |
| `TOVYR_DEFAULT_MODEL` | Default model id |
| `TOVYR_AUTO_FAILOVER` | `1` = retry on hard provider failures |
| `TOVYR_CROSS_PROVIDER_FAILOVER` | `1` = allow hopping across providers (with `TOVYR_AUTO_FAILOVER`) |
| `TOVYR_FIRST_RESPONSE_TIMEOUT_MS` | Stop a request with no response event (default `30000`; `0` disables) |
| `TOVYR_STREAM_IDLE_TIMEOUT_MS` | Abort a stream that starts and then goes idle (default `45000`) |
| `TOVYR_CODE_ENABLE_TELEMETRY` | `1` = opt in to analytics (default is no-telemetry) |
| `TOVYR_PROXY_DEBUG` | `1` = log proxy traffic to `.tovyr/proxy-debug.log` |

### Failover

- **Same-provider model recovery** on 404 is automatic when a verified alternate model exists.
- **Cross-provider failover** requires `TOVYR_AUTO_FAILOVER=1` and `TOVYR_CROSS_PROVIDER_FAILOVER=1`.

---

## Supported models

### Curated vs free-form

Each provider in the catalog has a **curated** `models` list (quick picks in `/model` and `tovyr models`). Providers marked `anyModel: true` (OpenRouter, Ollama, HuggingFace, …) accept **any** model id their platform supports:

```bash
tovyr provider model openai/gpt-4o
tovyr provider model your-custom-model-id
```

### Model tiers

In `tovyr models` and `/model`:

| Tier | Meaning |
|------|---------|
| **opus** | Highest capability |
| **sonnet** | Balanced (default for coding) |
| **haiku** | Fast / economical |

### Verified models

In the TUI model picker, **✓** means the provider confirmed the model works with your API key. Prefer verified models when available.

### Capabilities metadata

Tovyr tracks per-model capabilities (tool calling, streaming, vision, context window, cost tier) in `src/services/tovyr/modelCapabilities.ts`. Use `tovyr models` or `/model` for human-readable lists.

---

## Configuration files

### `~/.tovyr/providers.json`

Primary provider registry (read/written by `scripts/tovyr-providers.js`).

```json
{
  "active": "freemodel",
  "keys": {
    "freemodel": "fe_oa_...",
    "openrouter": "sk-or-..."
  },
  "models": {
    "freemodel": "tovyr-sonnet",
    "ollama": "llama3.2"
  },
  "endpoints": {
    "custom": "https://your-gateway.example.com/v1",
    "litellm": "http://127.0.0.1:4000"
  },
  "custom": {
    "baseUrl": "https://your-endpoint.example.com/v1",
    "label": "My gateway"
  }
}
```

| Field | Description |
|-------|-------------|
| `active` | Current provider id (`freemodel`, `openrouter`, `ollama`, …) |
| `keys` | Per-provider API keys |
| `models` | Per-provider selected model id |
| `endpoints` | Per-provider base URL overrides |
| `custom` | Label + URL for the `custom` provider entry |

Legacy `~/.tovyr/api-key` is migrated to `keys.freemodel` on first load.

### Project files

| Path | Purpose |
|------|---------|
| `tovyr.md` | Project instructions for the agent (`/init` creates this) |
| `tovyrplan.md` | Plan artifact from `/plan` mode |
| `.tovyr/` | Project-local settings, sessions |
| `~/.tovyr/agent/session-*.json` | Persisted `/agent` sessions per project cwd |

### View current config

```bash
tovyr config
tovyr config --json
```

---

## Commands and examples

### Shell commands (launcher — fast, no Bun compile)

| Command | Example |
|---------|---------|
| `tovyr` | Start interactive UI |
| `tovyr ask <q>` | `tovyr ask "explain main.tsx"` |
| `tovyr -p <prompt>` | `tovyr -p "run tests"` |
| `tovyr setup` | First-run checks |
| `tovyr doctor [--json]` | `tovyr doctor --json` |
| `tovyr bench [--live]` | `tovyr bench --suite smoke` |
| `tovyr config [--json]` | Show provider + paths |
| `tovyr auth login --key <k>` | Save API key |
| `tovyr provider list` | List providers |
| `tovyr provider use <id>` | `tovyr provider use ollama` |
| `tovyr provider model <id>` | Set model |
| `tovyr models [id]` | List models |
| `tovyr --help` | Full launcher help |
| `tovyr --version` | Version string |

### Global flags

| Flag | Effect |
|------|--------|
| `-h, --help` | Help |
| `-q, --quiet` | Minimal stderr |
| `--verbose` | Detailed output |
| `--debug` | Debug logging |
| `--json` | JSON on `config`, `doctor`, `provider` |
| `--fast` | Fast startup (default) — built-in tools (shell, files, search, web, skills, agents) |
| `--full` | Load all plugins + MCP servers (slower than default) |
| `--allow-home` | Allow launch from home directory |
| `-p, --print` | Print mode |
| `--output-format json` | JSON output with print mode |

**Exit codes:** `0` success · `1` error · `2` usage

### Commander subcommands (full CLI — `tovyr <cmd> --help`)

Available after Bun loads `main.tsx`:

| Command | Purpose |
|---------|---------|
| `tovyr mcp` | Add/list/remove MCP servers |
| `tovyr plugin` | Install/validate plugins |
| `tovyr auth` | login / status / logout (interactive OAuth paths) |
| `tovyr update` | Update Tovyr |
| `tovyr install` | Native binary install |

### Slash commands (in-app)

| Area | Commands |
|------|----------|
| **Setup** | `/guide`, `/help`, `/init`, `/doctor` |
| **Modes** | `/plan`, `/code`, `/auto`, `/bypass`, `/superthink` |
| **Build** | `/build`, `/fix`, `/debug`, `/review`, `/verify` |
| **Agents** | `/agent start`, `/agent status`, `/agent resume`, `/agent autofix`, `/agent stop`, `/peers` |
| **Models** | `/model`, `/provider` |
| **Memory** | `/buddy`, `/clear`, `/resume` |
| **Config** | `/config`, `/theme`, `/permissions` |

Plan mode writes `tovyrplan.md`; `/code` implements the accepted plan.

`/auto` is classifier-guarded autonomy, not bypass mode. It can approve routine
workspace edits and allowlisted commands for supported models, while destructive
commands, secret paths, unusual shell operations, and cross-machine messages
retain their permission checks.

---

## Common workflows

### Paste a screenshot or image

1. Copy an image to the clipboard (Win+Shift+S, snipping tool, etc.)
2. In Tovyr, press **Ctrl+V** (or your `chat:imagePaste` binding)
3. You should see `[Image #N]` attached to your prompt — then ask about it

Use a **vision-capable** model (`/model`) when describing screenshots UI, mockups, or errors. Text-only models may reject image payloads.

### Fix failing tests

```
/fix
```

or

```
/agent start fix failing tests and run the test suite
```

### Plan then implement

```
/plan add user authentication with JWT
```

Review `tovyrplan.md`, then:

```
/code
```

### Switch to a fast model for chat

```
/model
```

Pick a **✓ Fast** (haiku-tier) verified model.

### Collaborate across Tovyr sessions

Start Tovyr in two project terminals, then run:

```text
/peers
```

The model-facing equivalent is `ListPeers`. Its results include an address such
as `uds:\\.\pipe\tovyr-...` on Windows or `uds:/tmp/tovyr-....sock` on Unix.
`SendMessage` accepts that address. Messages queue while the receiving session
is busy and arrive as attributed cross-session user turns. The JSONL protocol
is capped at 256 KiB and can also be implemented by another local AI agent.

### Scripting / CI

```bash
tovyr -p "summarize git diff" --output-format json
tovyr doctor --json
tovyr config --json
tovyr provider list --json
```

### Local models with Ollama

```bash
ollama serve
ollama pull llama3.2
tovyr provider use ollama
tovyr provider model llama3.2
cd your-project && tovyr
```

### Web tools

Built-in **WebSearch**, **WebFetch**, and **TovyrWeb** work without a browser extension. Use `/browser` for research-style browsing when configured.

---

## Safety features

Tovyr includes several layers of protection for tool execution. **Full details:** [docs/SAFETY.md](SAFETY.md).

### Permission modes

| Mode | Behavior |
|------|----------|
| **Default (Ask)** | Auto-accepts Write/Edit and allowlisted shell (`git`, `gh`, `npm`, …); prompts for unusual/destructive commands |
| **Plan** | Read-only planning; blocks writes |
| **Code / acceptEdits** | Same auto-edit behavior as Ask |
| **Auto** | Classifier-guarded routine edits and commands; risky actions still ask |
| **Bypass** | Fewer prompts — use only when you accept the risk |

### Destructive shell blocking

In Tovyr runtime, commands matching patterns like `rm -rf`, `git push --force`, `git reset --hard`, `DROP DATABASE`, etc. are blocked or require explicit user confirmation (`src/services/tovyr/permissions/destructiveShell.ts`).

### Path validation

File tools validate paths before execution:

- Blocks shell expansion (`$HOME`, `%TEMP%`, …)
- Blocks dangerous UNC paths
- Blocks glob patterns on write operations
- Rejects path traversal outside allowed directories

### Tool execution safety layer

`src/services/tovyr/tools/safety.ts` provides:

- Secret redaction in debug logs (API keys, bearer tokens, env assignments)
- Structured error messages (timeout, cancellation, path denied, …)
- Safe retry policy (transient network/timeout only — not permission errors)
- Pre-flight path checks for Read/Edit/Write in Tovyr runtime

### Agent loop limits

When an `/agent` session is active (`src/services/tovyr/agent/loopGuard.ts`):

| Limit | Default |
|-------|---------|
| Max turns | 50 |
| Max tool calls | 150 |
| Session timeout | 30 minutes |
| Repeated identical failures | 3 → stop |
| Empty model outputs | 2 → stop |

The main REPL chat loop does **not** apply these limits unless an `/agent` session is running.

### Unicode / prompt injection from files

In Tovyr runtime, file read content is sanitized (`partiallySanitizeUnicode`) to remove hidden Unicode injection characters. MCP tool definitions receive the same treatment.

### Log redaction

Debug and tool logs redact API keys, bearer tokens, and env assignments when running as Tovyr (`bridge/debugUtils.ts`).

### Git checkpoints

Before the first file edit in an assistant turn, Tovyr can create a git checkpoint (`src/services/tovyr/git/editHook.ts`) so changes can be recovered.

### Home directory guard

Launching from `~` / `%USERPROFILE%` without project markers is blocked to prevent slow, unsafe runs over the entire home folder.

---

## Troubleshooting

### `tovyr` not found (Windows)

Open a **new** terminal after `npm install -g`. Or run `bin\install-tovyr.cmd` from the repo.

### Compiling for minutes on first launch

```bash
npm run warm
```

Then restart `tovyr`. Spinner shows elapsed time during compile.

### No API key / auth errors

```bash
tovyr auth login --key YOUR_KEY
tovyr setup
tovyr config
```

Do **not** use `/login` for API-key auth — use `tovyr auth login` or `/provider`.

### Model sends no response

Tovyr stops a model that has not produced its first response event after 30 seconds by default, then tries another verified model on the same provider when one is available. Use `/model` or `/provider` to switch manually, or raise `TOVYR_FIRST_RESPONSE_TIMEOUT_MS` for a provider with known cold starts.

### Stream starts, then stalls

The provider stopped sending events for the idle watchdog window (default `45000` ms via `TOVYR_STREAM_IDLE_TIMEOUT_MS`). Try another model, raise the timeout, enable `TOVYR_AUTO_FAILOVER=1`, or check `TOVYR_PROXY_DEBUG=1` logs in `.tovyr/proxy-debug.log`.

### Enter does nothing (Windows)

Wait until the Tovyr prompt appears. Early keystrokes are replayed once the REPL mounts.

### Plugins / MCP missing

Default `tovyr` uses `--bare` (fast startup) with a rich built-in toolset — shell, files, search, web, skills, and agents. Marketplace plugins and extra MCP servers require `tovyr --full`.

### Doctor vs setup

Both run the same install checker (`scripts/tovyr-doctor.js`). `setup` uses onboarding-oriented messaging when the API key is missing.

```bash
tovyr doctor --json    # machine-readable for CI
```

### Benchmarking the CLI

Repeatable scorecard for comparing providers, models, or releases:

```bash
tovyr bench                    # full offline suite (~10s, no API)
tovyr bench --suite smoke      # fastest checks
tovyr bench --live             # + model ping, math, latency (needs API key)
tovyr bench --json             # CI-friendly JSON report
tovyr bench compare            # diff latest vs previous run
```

Reports save to `.tovyr/benchmarks/latest.json` (and timestamped history). Offline cases cover doctor, project scan, safety patterns, permissions, and tool helpers. Live cases measure end-to-end print-mode latency and basic model quality.

---

## Development setup

### Prerequisites

- Bun (https://bun.sh)
- Node 18+

### Run from source

```bash
bun run src/entrypoints/cli.tsx          # dev
bun run src/entrypoints/cli.tsx --version
```

### Tests

```bash
npm test                                              # full suite (~550 tests)
bun test scripts/tovyr-cli.integration.test.ts        # CLI integration
bun test src/services/tovyr/tools/safety.test.ts          # tool safety
bun test src/services/tovyr/agent/loopGuard.test.ts       # agent limits
```

### Key paths

| Path | Purpose |
|------|---------|
| `bin/tovyr.js` | npm launcher |
| `src/entrypoints/cli.tsx` | Bun bootstrap |
| `main.tsx` | Commander CLI + REPL |
| `query.ts` | Agent tool loop |
| `tools.ts` | Built-in tool registry |
| `scripts/tovyr-providers.js` | Provider state |
| `scripts/tovyr-provider-catalog.js` | Provider catalog |
| `src/services/tovyr/agent/` | `/agent` autonomous loop |
| `src/services/tovyr/tools/safety.ts` | Tool safety helpers |

### Environment (development)

| Variable | Purpose |
|----------|---------|
| `TOVYR_SRC` / `TOVYR_PACKAGE_ROOT` | Package root override |
| `TOVYR_DEBUG` | Debug logging |
| `TOVYR_QUIET` | Suppress stderr |
| `TOVYR_SKIP_WARM` | Skip compile warm step |

---

## How to add a provider

### Option 1: Use `custom` (no code change)

1. Switch to custom:
   ```bash
   tovyr provider use custom
   ```
2. Set URL via `/provider url <https://your-endpoint/v1>` in the TUI, or edit `~/.tovyr/providers.json`:
   ```json
   {
     "active": "custom",
     "keys": { "custom": "your-api-key" },
     "custom": { "baseUrl": "https://your-endpoint.example.com/v1", "label": "My API" }
   }
   ```
3. Set model: `tovyr provider model your-model-id`

### Option 2: Add to the catalog (contributors)

1. Add an entry to `scripts/tovyr-provider-catalog.js` or `scripts/tovyr-provider-catalog-extra.js`:

   ```javascript
   myprovider: {
     id: 'myprovider',
     label: 'My Provider',
     category: 'gateway',
     baseUrl: 'https://api.example.com/v1',
     keyPrefix: 'mp-',
     keyHint: 'mp-...',
     signup: 'https://example.com/keys',
     apiFormat: 'openai',   // if OpenAI-compatible
     anyModel: true,          // optional: accept any model id
     models: [
       { id: 'model-a', label: 'Model A', tier: 'sonnet' },
     ],
   },
   ```

2. For **local** providers (no key), add the id to `LOCAL_PROVIDER_IDS` in `scripts/tovyr-provider-local.js`.

3. Run tests: `bun test scripts/tovyr-provider-cli.test.ts`

4. Users activate with:
   ```bash
   tovyr auth login --provider myprovider --key mp-...
   tovyr provider use myprovider
   ```

---

## How to add a tool

### Built-in tool (core codebase)

1. **Create a tool module** under `tools/MyTool/` following an existing tool (e.g. `tools/GrepTool/`). Implement the `Tool` interface from `Tool.ts`:
   - `name`, `description`, `inputSchema`, `call()`, `mapToolResultToToolResultBlockParam()`

2. **Register** in `tools.ts` inside `getAllBaseTools()`:
   ```typescript
   import { MyTool } from './tools/MyTool/MyTool.js'
   // ...
   MyTool,
   ```

3. **Permissions** (optional): add rules in `src/utils/permissions/` or `src/services/tovyr/permissions/toolGate.ts` for Tovyr-specific gates.

4. **Tests**: add `src/tools/MyTool/MyTool.test.ts` or integration tests under `src/services/tovyr/`.

### MCP tool (no core code change)

```bash
tovyr mcp add-json myserver '{"command":"node","args":["path/to/server.js"]}'
tovyr mcp list
```

Use `tovyr --full` to load MCP servers on startup (default `--bare` skips heavy plugin/MCP loading).

### Plugin tool

Install a plugin that registers tools via the plugin system (`plugins/PluginSystem.ts`):

```bash
tovyr plugin install <plugin>
```

---

## How to add an agent

Tovyr has **three** agent-related mechanisms — pick the one that fits:

### 1. Autonomous `/agent` session (built-in, persisted)

Multi-step goals with phases (observe → plan → execute → verify → reflect):

```
/agent start implement JWT authentication with tests
/agent status
/agent autofix
/agent resume
/agent stop
```

- Implementation: `src/services/tovyr/agent/` (`AgentManager`, `ExecutionEngine`, `loopGuard`)
- State: `~/.tovyr/agent/session-<project-slug>.json`
- Slash command: `src/commands/tovyr/agent.ts`

To extend behavior, edit prompts in `src/services/tovyr/agent/` (e.g. `ExecutionEngine.ts`, `specialists.ts`) or add specialist roles in `src/services/tovyr/agent/types.ts`.

### 2. Sub-agents via the `Agent` tool

The main chat loop can spawn named sub-agents for parallel exploration using the built-in **Agent** tool (`tools/AgentTool/`). Named agents remain addressable with `SendMessage` while running. If a named agent stopped or its task was evicted, a follow-up message resumes it from its persisted transcript. Configure allowed tools via permission rules and `--allowed-tools`.

Subagents are children of one Tovyr session. For collaboration between separate
Tovyr processes—or with another local AI harness—use `/peers`, `ListPeers`, and
`SendMessage` with a returned `uds:` address.

### 3. Custom agents (CLI flag)

Pass custom agent definitions at startup:

```bash
tovyr --agents '{"reviewer":{"description":"Code reviewer","prompt":"You review diffs..."}}'
tovyr --agent reviewer
```

Parsed in `main.tsx` (~line 2055). Agents are session-scoped prompt presets, not persisted `/agent` sessions.

### 4. New slash command (prompt-only “agent”)

To add a workflow command like `/myworkflow`:

1. Create `src/commands/tovyr/myworkflow.ts` (see `src/commands/tovyr/fix.ts`)
2. Register in `commands.ts`
3. Command appears as `/myworkflow` in the REPL

---

## Browser automation

Run `/browser setup` to configure the pinned Playwright MCP runtime with a
Tovyr-owned profile. `/browser status` reports configuration, while
`/browser connect chrome` or `/browser connect edge` explicitly opts into a
running browser through CDP. The default never reuses the user's normal
browser state.

Tovyr stores the isolated profile under `~/.tovyr/browser/profile` and
downloads/captures under `~/.tovyr/browser/output`. It uses accessibility
snapshots before screenshots. Clicks, typing, forms, files, clipboard, and
login actions require confirmation. Private-network navigation is blocked
unless `TOVYR_BROWSER_ALLOW_PRIVATE_NETWORK=1` is deliberately enabled for a
trusted local project.

## Windows computer-use beta

`/computer status` reports this feature honestly. It is off by default and is
ready only on Windows after `/computer enable` and installation of the signed
`~/.tovyr/runtime/tovyr-computer-host.exe`.

Tovyr never substitutes a Claude, browser-extension, or unsigned host. The
adapter enforces one active session lock, sends Escape/Ctrl+C stop keys to the
host, redacts typed and clipboard text from its audit, and supports an
application allowlist. Screenshot retention defaults to `never`.

---

## Getting help

- **In-app:** `/guide`, `/help`
- **Shell:** `tovyr --help`, `tovyr doctor --help`, `tovyr provider --help`
- **GitHub:** [itzdexy/Tovyr](https://github.com/itzdexy/Tovyr)
- **Issues:** [github.com/itzdexy/Tovyr/issues](https://github.com/itzdexy/Tovyr/issues)

## Local compatibility gateway

Run `tovyr serve` to expose the active Tovyr provider through a loopback gateway on port `11434` (or set `TOVYR_GATEWAY_PORT`). Loopback clients are allowed without a token so app launchers can reuse an already-running gateway, matching Ollama's local behavior; set `TOVYR_GATEWAY_REQUIRE_AUTH=1` to require the bearer token locally. Non-loopback binds remain authenticated. The gateway accepts native streaming and JSON requests at `/v1/chat/completions`, `/v1/messages`, and `/v1/responses`, plus Ollama-compatible `/api/chat`, `/api/generate`, and `/api/tags` routes.

The same gateway works with clients that support a custom API base URL:

- Claude Code/CLI and Claude-compatible desktop clients: base URL `http://127.0.0.1:11434`, gateway token as `ANTHROPIC_API_KEY` (or `x-api-key`), and a Tovyr model such as `anthropic::claude-sonnet-5`.
- Official Claude Desktop connects local tools through MCP/desktop extensions rather than replacing its hosted model endpoint; use `tovyr mcp serve` for Tovyr tools, or an API-configurable desktop client for Tovyr model routing.
- Kimi and other OpenAI-compatible clients (OpenCode, Hermes Agent, OpenClaw, Droid, Pi, Copilot CLI): base URL `http://127.0.0.1:11434/v1`, gateway token as a bearer API key, and a qualified model such as `openrouter::moonshotai/kimi-k3`.
- Codex: configure `oss_provider = "tovyr"` with the same `/v1` base URL and `TOVYR_GATEWAY_TOKEN`; `/model` loads every connected Tovyr model.
- ChatGPT Desktop: use its separate Codex view with `tovyr chatgpt`; the normal Chat and Work views use OpenAI-hosted models and cannot be redirected to a custom API endpoint. ChatGPT Apps/MCP can add tools and data, but do not replace the conversation model.

Use a qualified `provider::model` id to select a specific upstream provider. The gateway keeps that id visible to the client and sends only the provider-native model id upstream. Providers and models are listed only after Tovyr has valid saved credentials (local providers are opt-in).
### One-command app launchers

The Node launcher can choose a connected provider/model before starting a compatible client:

```text
tovyr codex
tovyr launch codex
tovyr codex --provider openrouter --model openai/gpt-5
tovyr chatgpt --provider openrouter --model openai/gpt-5
tovyr claude
tovyr claude --provider anthropic --model claude-sonnet-5
tovyr providers list
tovyr apps list
tovyr apps status chatgpt
tovyr apps doctor claude-desktop
tovyr apps configure hermes-agent --provider openrouter --model moonshotai/kimi-k3
tovyr apps disconnect <app>
tovyr apps restore <app>
```

The application manager reports the boundary between model routing, MCP tools,
and copyable endpoint recipes:

| Client | Integration | Current state | Command |
| --- | --- | --- | --- |
| Codex CLI | Model routing | Ready | `tovyr codex` |
| ChatGPT Desktop | Model routing in **Codex view only** | Ready when `OpenAI.Codex` AppX is installed | `tovyr chatgpt` |
| Claude Code | Model routing | Ready when `claude` is on PATH | `tovyr claude` |
| Claude Desktop | MCP tools | Tool-only; hosted model cannot be replaced | `tovyr mcp serve` |
| OpenCode | OpenAI-compatible endpoint | Manual setup | `tovyr apps configure opencode` |
| Hermes Agent | OpenAI-compatible endpoint | Manual setup | `tovyr apps configure hermes-agent` |
| OpenClaw | OpenAI-compatible endpoint | Manual setup | `tovyr apps configure openclaw` |
| Droid | OpenAI-compatible endpoint | Manual setup | `tovyr apps configure droid` |
| Pi | OpenAI-compatible endpoint | Manual setup | `tovyr apps configure pi` |
| Kimi | OpenAI-compatible endpoint | Manual setup | `tovyr apps configure kimi` |
| GitHub Copilot CLI | MCP tools | Tool-only; GitHub controls its model | `tovyr mcp serve` |
| Any OpenAI-compatible client | OpenAI-compatible endpoint | Manual setup | `tovyr apps configure openai-compatible` |

Use `tovyr apps status [app]` for discovery, `tovyr apps doctor [app]` for a
safe recovery command, and `tovyr apps list` to print the complete matrix.
`configure` returns the loopback endpoint and a qualified `provider::model`
identifier without writing third-party credentials. `disconnect` removes only
Tovyr-managed metadata; `restore` restores only a backup previously recorded by
Tovyr for that exact application target.

`tovyr codex` starts a temporary loopback gateway and launches the official Codex CLI with `--oss --local-provider tovyr`. The launcher also overrides Codex's per-session `notify` hook (`notify=[]`) so a user-configured Windows turn-end sound does not make successful Tovyr responses sound like errors, and disables commonly unavailable optional MCP servers for that process so their startup/OAuth warnings do not look like gateway failures; direct `codex` runs keep the user's settings. `tovyr claude` does the same for Claude Code/CLI using the Anthropic Messages protocol. The gateway is stopped when the client exits unless a healthy gateway is already available.

`tovyr chatgpt` is the one-command desktop route: it starts a managed loopback gateway and launches the installed ChatGPT Desktop package directly, avoiding the legacy CLI installer check. In its Codex composer, use `/model` to select any connected Tovyr model. Stop only that Tovyr-managed background gateway with `tovyr apps stop chatgpt`; a manually started `tovyr serve` is never stopped. This affects the Codex view only—not Chat or Work—and it does not write credentials into the desktop app's config.

When stdin is not interactive (scripts, PowerShell pipes, or CI), the launcher uses Tovyr's active provider/model instead of waiting for a picker. Pass `--provider` and `--model` whenever a script should pin a specific choice.

`configure` and `status` are read-only for external applications. Claude Desktop
does not expose a supported arbitrary custom-model API endpoint; use Claude Code
or another configurable Anthropic client for model routing. `tovyr chatgpt`
launches the supported Codex-view route in ChatGPT Desktop; Chat and Work remain
hosted-model experiences. Claude Desktop can still connect Tovyr tools through
`tovyr mcp serve`.
