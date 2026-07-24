# Blink — User Guide

Complete guide for installing, configuring, and using **Blink v2.00.5**. This document reflects **what is implemented today** in this repository.

---

## Table of contents

1. [What Blink does](#what-blink-does)
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

## What Blink does

Blink is an **AI coding agent in your terminal**. You work in a project directory; Blink:

- **Reads** files and searches the codebase (Read, Grep, Glob)
- **Edits** files with diff-aware patches (Edit, Write)
- **Runs** shell commands (Bash; PowerShell on Windows when enabled)
- **Plans** work in plan mode (`/plan` → `blinkplan.md`)
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
| **npm launcher** | `bin/blink.js` | `--help`, `doctor`, `provider`, `auth`, routes to Bun UI |
| **Full CLI** | `entrypoints/cli.tsx` → `main.tsx` | Interactive REPL, Commander subcommands (`mcp`, `plugin`, …) |

The npm package alone does **not** include the Ink UI. Clone the repo, install Bun, run `npm run warm`, then `npm install -g .` for the full experience.

---

## Installation

### Requirements

| Component | npm install | Source install |
|-----------|-------------|----------------|
| Node.js | 18+ | 18+ |
| Bun | Optional | **Required** |
| OS | Windows, macOS, Linux | Same |

### npm global

```bash
npm install -g blinkcode
```

On Windows, open a **new** terminal so `blink` is on PATH. If not found, run `bin\install-blink.cmd` from a source checkout.

### Source (recommended)

```bash
git clone https://github.com/itsdexy/BlinkCode.git
cd BlinkCode
npm install
npm run warm
npm install -g .
blink setup
```

`npm run warm` pre-compiles the UI so the first interactive launch takes seconds instead of minutes (especially on Windows).

---

## Quickstart

```bash
# 1. First-run checks
blink setup

# 2. Authenticate (FreeModel example)
blink auth login --key fe_oa_YOUR_KEY_HERE

# 3. Confirm configuration
blink config

# 4. Start in a project folder
cd path/to/your-project
blink
```

**Do not** run `blink` from your home directory — the launcher blocks this by default. Use `cd` into a project first, or `blink --allow-home` (not recommended).

**Print mode** (scripting, no TUI):

```bash
blink ask "what does this repo do?"
blink -p "list all TODO comments" --output-format json
```

---

## API keys and providers

### Saving keys

```bash
# Default provider (FreeModel)
blink auth login --key fe_oa_YOUR_KEY

# Named provider
blink auth login --provider freemodel --key fe_oa_YOUR_KEY
blink auth login --provider openrouter --key sk-or-YOUR_KEY
```

Keys are stored under `~/.blink/` on your machine (never in the npm package).

### Switching providers

```bash
blink provider list
blink provider use openrouter
blink provider model blink/sonnet
blink models                    # models for active provider
blink models ollama             # models for a specific provider
```

In the TUI: `/provider use <id>` and `/model`.

### Provider categories

Run `blink provider list` for the live catalog. Major groups:

| Category | Examples | API key? |
|----------|----------|----------|
| **Official** | FreeModel, Blink Direct | Yes |
| **Gateway** | OpenRouter, Portkey, LiteLLM | Yes |
| **API** | Google (via gateway), xAI, Mistral, Groq, … | Yes |
| **Self-hosted** | Ollama, LM Studio, Custom endpoint | Ollama/LM Studio: no |
| **Cloud** | AWS Bedrock, Azure, Vertex (via compat URL) | Yes |

### Local providers (no cloud key)

```bash
# Ollama — start server first: ollama serve
blink provider use ollama
blink provider model llama3.2

# LM Studio — start local server on port 1234
blink provider use lmstudio
blink provider model <model-id-from-lm-studio>
```

### OpenAI and Gemini (honest status)

- **Native `api.openai.com`** is **not** directly supported (OpenAI-format only; Blink needs tool-calling via its proxy).
- Use **OpenRouter**, **Portkey**, **LiteLLM**, or another gateway: `blink provider use openrouter`.
- **Gemini**: use OpenRouter/Portkey model ids (`google/gemini-…`) or point the `google` / `custom` provider at a Vertex-compatible gateway URL.

### Environment overrides

| Variable | Purpose |
|----------|---------|
| `BLINK_API_KEY` | API key (alternative to `auth login`) |
| `BLINK_PROVIDER_BASE_URL` | Override API base URL |
| `BLINK_DEFAULT_MODEL` | Default model id |
| `BLINK_AUTO_FAILOVER` | `1` = retry on hard provider failures |
| `BLINK_CROSS_PROVIDER_FAILOVER` | `1` = allow hopping across providers (with `BLINK_AUTO_FAILOVER`) |
| `BLINK_PROXY_DEBUG` | `1` = log proxy traffic to `.blink/proxy-debug.log` |

### Failover

- **Same-provider model recovery** on 404 is automatic when a verified alternate model exists.
- **Cross-provider failover** requires `BLINK_AUTO_FAILOVER=1` and `BLINK_CROSS_PROVIDER_FAILOVER=1`.

---

## Supported models

### Curated vs free-form

Each provider in the catalog has a **curated** `models` list (quick picks in `/model` and `blink models`). Providers marked `anyModel: true` (OpenRouter, Ollama, HuggingFace, …) accept **any** model id their platform supports:

```bash
blink provider model openai/gpt-4o
blink provider model your-custom-model-id
```

### Model tiers

In `blink models` and `/model`:

| Tier | Meaning |
|------|---------|
| **opus** | Highest capability |
| **sonnet** | Balanced (default for coding) |
| **haiku** | Fast / economical |

### Verified models

In the TUI model picker, **✓** means the provider confirmed the model works with your API key. Prefer verified models when available.

### Capabilities metadata

Blink tracks per-model capabilities (tool calling, streaming, vision, context window, cost tier) in `services/blink/modelCapabilities.ts`. Use `blink models` or `/model` for human-readable lists.

---

## Configuration files

### `~/.blink/providers.json`

Primary provider registry (read/written by `scripts/blink-providers.js`).

```json
{
  "active": "freemodel",
  "keys": {
    "freemodel": "fe_oa_...",
    "openrouter": "sk-or-..."
  },
  "models": {
    "freemodel": "blink-sonnet",
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

Legacy `~/.blink/api-key` is migrated to `keys.freemodel` on first load.

### Project files

| Path | Purpose |
|------|---------|
| `blink.md` | Project instructions for the agent (`/init` creates this) |
| `blinkplan.md` | Plan artifact from `/plan` mode |
| `.blink/` | Project-local settings, sessions |
| `~/.blink/agent/session-*.json` | Persisted `/agent` sessions per project cwd |

### View current config

```bash
blink config
blink config --json
```

---

## Commands and examples

### Shell commands (launcher — fast, no Bun compile)

| Command | Example |
|---------|---------|
| `blink` | Start interactive UI |
| `blink ask <q>` | `blink ask "explain main.tsx"` |
| `blink -p <prompt>` | `blink -p "run tests"` |
| `blink setup` | First-run checks |
| `blink doctor [--json]` | `blink doctor --json` |
| `blink bench [--live]` | `blink bench --suite smoke` |
| `blink config [--json]` | Show provider + paths |
| `blink auth login --key <k>` | Save API key |
| `blink provider list` | List providers |
| `blink provider use <id>` | `blink provider use ollama` |
| `blink provider model <id>` | Set model |
| `blink models [id]` | List models |
| `blink --help` | Full launcher help |
| `blink --version` | Version string |

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

### Commander subcommands (full CLI — `blink <cmd> --help`)

Available after Bun loads `main.tsx`:

| Command | Purpose |
|---------|---------|
| `blink mcp` | Add/list/remove MCP servers |
| `blink plugin` | Install/validate plugins |
| `blink auth` | login / status / logout (interactive OAuth paths) |
| `blink update` | Update Blink |
| `blink install` | Native binary install |

### Slash commands (in-app)

| Area | Commands |
|------|----------|
| **Setup** | `/guide`, `/help`, `/init`, `/doctor` |
| **Modes** | `/plan`, `/code`, `/bypass`, `/superthink` |
| **Build** | `/build`, `/fix`, `/debug`, `/review`, `/verify` |
| **Agents** | `/agent start`, `/agent status`, `/agent resume`, `/agent autofix`, `/agent stop` |
| **Models** | `/model`, `/provider` |
| **Memory** | `/buddy`, `/clear`, `/resume` |
| **Config** | `/config`, `/theme`, `/permissions` |

Plan mode writes `blinkplan.md`; `/code` implements the accepted plan.

---

## Common workflows

### Paste a screenshot or image

1. Copy an image to the clipboard (Win+Shift+S, snipping tool, etc.)
2. In Blink, press **Ctrl+V** (or your `chat:imagePaste` binding)
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

Review `blinkplan.md`, then:

```
/code
```

### Switch to a fast model for chat

```
/model
```

Pick a **✓ Fast** (haiku-tier) verified model.

### Scripting / CI

```bash
blink -p "summarize git diff" --output-format json
blink doctor --json
blink config --json
blink provider list --json
```

### Local models with Ollama

```bash
ollama serve
ollama pull llama3.2
blink provider use ollama
blink provider model llama3.2
cd your-project && blink
```

### Web tools

Built-in **WebSearch**, **WebFetch**, and **BlinkWeb** work without a browser extension. Use `/browser` for research-style browsing when configured.

---

## Safety features

Blink includes several layers of protection for tool execution. **Full details:** [docs/SAFETY.md](SAFETY.md).

### Permission modes

| Mode | Behavior |
|------|----------|
| **Default (Ask)** | Auto-accepts Write/Edit and allowlisted shell (`git`, `gh`, `npm`, …); prompts for unusual/destructive commands |
| **Plan** | Read-only planning; blocks writes |
| **Code / acceptEdits** | Same auto-edit behavior as Ask |
| **Bypass** | Fewer prompts — use only when you accept the risk |

### Destructive shell blocking

In Blink runtime, commands matching patterns like `rm -rf`, `git push --force`, `git reset --hard`, `DROP DATABASE`, etc. are blocked or require explicit user confirmation (`services/blink/permissions/destructiveShell.ts`).

### Path validation

File tools validate paths before execution:

- Blocks shell expansion (`$HOME`, `%TEMP%`, …)
- Blocks dangerous UNC paths
- Blocks glob patterns on write operations
- Rejects path traversal outside allowed directories

### Tool execution safety layer

`services/blink/tools/safety.ts` provides:

- Secret redaction in debug logs (API keys, bearer tokens, env assignments)
- Structured error messages (timeout, cancellation, path denied, …)
- Safe retry policy (transient network/timeout only — not permission errors)
- Pre-flight path checks for Read/Edit/Write in Blink runtime

### Agent loop limits

When an `/agent` session is active (`services/blink/agent/loopGuard.ts`):

| Limit | Default |
|-------|---------|
| Max turns | 50 |
| Max tool calls | 150 |
| Session timeout | 30 minutes |
| Repeated identical failures | 3 → stop |
| Empty model outputs | 2 → stop |

The main REPL chat loop does **not** apply these limits unless an `/agent` session is running.

### Unicode / prompt injection from files

In Blink runtime, file read content is sanitized (`partiallySanitizeUnicode`) to remove hidden Unicode injection characters. MCP tool definitions receive the same treatment.

### Log redaction

Debug and tool logs redact API keys, bearer tokens, and env assignments when running as Blink (`bridge/debugUtils.ts`).

### Git checkpoints

Before the first file edit in an assistant turn, Blink can create a git checkpoint (`services/blink/git/editHook.ts`) so changes can be recovered.

### Home directory guard

Launching from `~` / `%USERPROFILE%` without project markers is blocked to prevent slow, unsafe runs over the entire home folder.

---

## Troubleshooting

### `blink` not found (Windows)

Open a **new** terminal after `npm install -g`. Or run `bin\install-blink.cmd` from the repo.

### Compiling for minutes on first launch

```bash
npm run warm
```

Then restart `blink`. Spinner shows elapsed time during compile.

### No API key / auth errors

```bash
blink auth login --key YOUR_KEY
blink setup
blink config
```

Do **not** use `/login` for API-key auth — use `blink auth login` or `/provider`.

### Model silent 30–120 seconds

GPU providers (NIM, etc.) cold-start. Wait for the spinner timer, or switch model/provider with `/model`.

### Stream timeout after ~2 minutes

Provider sent no tokens. Try another model, enable `BLINK_AUTO_FAILOVER=1`, or check `BLINK_PROXY_DEBUG=1` logs in `.blink/proxy-debug.log`.

### Enter does nothing (Windows)

Wait until the Blink prompt appears. Early keystrokes are replayed once the REPL mounts.

### Plugins / MCP missing

Default `blink` uses `--bare` (fast startup) with a rich built-in toolset — shell, files, search, web, skills, and agents. Marketplace plugins and extra MCP servers require `blink --full`.

### Doctor vs setup

Both run the same install checker (`scripts/blink-doctor.js`). `setup` uses onboarding-oriented messaging when the API key is missing.

```bash
blink doctor --json    # machine-readable for CI
```

### Benchmarking the CLI

Repeatable scorecard for comparing providers, models, or releases:

```bash
blink bench                    # full offline suite (~10s, no API)
blink bench --suite smoke      # fastest checks
blink bench --live             # + model ping, math, latency (needs API key)
blink bench --json             # CI-friendly JSON report
blink bench compare            # diff latest vs previous run
```

Reports save to `.blink/benchmarks/latest.json` (and timestamped history). Offline cases cover doctor, project scan, safety patterns, permissions, and tool helpers. Live cases measure end-to-end print-mode latency and basic model quality.

---

## Development setup

### Prerequisites

- Bun (https://bun.sh)
- Node 18+

### Run from source

```bash
bun run entrypoints/cli.tsx          # dev
bun run entrypoints/cli.tsx --version
```

### Tests

```bash
npm test                                              # full suite (~550 tests)
bun test scripts/blink-cli.integration.test.ts        # CLI integration
bun test services/blink/tools/safety.test.ts          # tool safety
bun test services/blink/agent/loopGuard.test.ts       # agent limits
```

### Key paths

| Path | Purpose |
|------|---------|
| `bin/blink.js` | npm launcher |
| `entrypoints/cli.tsx` | Bun bootstrap |
| `main.tsx` | Commander CLI + REPL |
| `query.ts` | Agent tool loop |
| `tools.ts` | Built-in tool registry |
| `scripts/blink-providers.js` | Provider state |
| `scripts/blink-provider-catalog.js` | Provider catalog |
| `services/blink/agent/` | `/agent` autonomous loop |
| `services/blink/tools/safety.ts` | Tool safety helpers |

### Environment (development)

| Variable | Purpose |
|----------|---------|
| `BLINK_SRC` / `BLINK_PACKAGE_ROOT` | Package root override |
| `BLINK_DEBUG` | Debug logging |
| `BLINK_QUIET` | Suppress stderr |
| `BLINK_SKIP_WARM` | Skip compile warm step |

---

## How to add a provider

### Option 1: Use `custom` (no code change)

1. Switch to custom:
   ```bash
   blink provider use custom
   ```
2. Set URL via `/provider url <https://your-endpoint/v1>` in the TUI, or edit `~/.blink/providers.json`:
   ```json
   {
     "active": "custom",
     "keys": { "custom": "your-api-key" },
     "custom": { "baseUrl": "https://your-endpoint.example.com/v1", "label": "My API" }
   }
   ```
3. Set model: `blink provider model your-model-id`

### Option 2: Add to the catalog (contributors)

1. Add an entry to `scripts/blink-provider-catalog.js` or `scripts/blink-provider-catalog-extra.js`:

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

2. For **local** providers (no key), add the id to `LOCAL_PROVIDER_IDS` in `scripts/blink-provider-local.js`.

3. Run tests: `bun test scripts/blink-provider-cli.test.ts`

4. Users activate with:
   ```bash
   blink auth login --provider myprovider --key mp-...
   blink provider use myprovider
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

3. **Permissions** (optional): add rules in `utils/permissions/` or `services/blink/permissions/toolGate.ts` for Blink-specific gates.

4. **Tests**: add `tools/MyTool/MyTool.test.ts` or integration tests under `services/blink/`.

### MCP tool (no core code change)

```bash
blink mcp add-json myserver '{"command":"node","args":["path/to/server.js"]}'
blink mcp list
```

Use `blink --full` to load MCP servers on startup (default `--bare` skips heavy plugin/MCP loading).

### Plugin tool

Install a plugin that registers tools via the plugin system (`plugins/PluginSystem.ts`):

```bash
blink plugin install <plugin>
```

---

## How to add an agent

Blink has **three** agent-related mechanisms — pick the one that fits:

### 1. Autonomous `/agent` session (built-in, persisted)

Multi-step goals with phases (observe → plan → execute → verify → reflect):

```
/agent start implement JWT authentication with tests
/agent status
/agent autofix
/agent resume
/agent stop
```

- Implementation: `services/blink/agent/` (`AgentManager`, `ExecutionEngine`, `loopGuard`)
- State: `~/.blink/agent/session-<project-slug>.json`
- Slash command: `commands/blink/agent.ts`

To extend behavior, edit prompts in `services/blink/agent/` (e.g. `ExecutionEngine.ts`, `specialists.ts`) or add specialist roles in `services/blink/agent/types.ts`.

### 2. Sub-agents via the `Agent` tool

The main chat loop can spawn sub-agents for parallel exploration using the built-in **Agent** tool (`tools/AgentTool/`). Configure allowed tools via permission rules and `--allowed-tools`.

### 3. Custom agents (CLI flag)

Pass custom agent definitions at startup:

```bash
blink --agents '{"reviewer":{"description":"Code reviewer","prompt":"You review diffs..."}}'
blink --agent reviewer
```

Parsed in `main.tsx` (~line 2055). Agents are session-scoped prompt presets, not persisted `/agent` sessions.

### 4. New slash command (prompt-only “agent”)

To add a workflow command like `/myworkflow`:

1. Create `commands/blink/myworkflow.ts` (see `commands/blink/fix.ts`)
2. Register in `commands.ts`
3. Command appears as `/myworkflow` in the REPL

---

## Getting help

- **In-app:** `/guide`, `/help`
- **Shell:** `blink --help`, `blink doctor --help`, `blink provider --help`
- **GitHub:** [itsdexy/BlinkCode](https://github.com/itsdexy/BlinkCode)
- **Issues:** [github.com/itsdexy/BlinkCode/issues](https://github.com/itsdexy/BlinkCode/issues)
