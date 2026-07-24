# Blink — Security & Safety

How Blink protects your machine, secrets, and work. This document describes **implemented** behavior in the current codebase.

---

## Overview

Blink is an AI agent with file and shell access. Safety is layered:

1. **Permission modes** — control what runs without asking
2. **Tool gates** — tier-based blocks (plan vs code vs bypass)
3. **Path validation** — block traversal, shell expansion, dangerous targets
4. **Destructive shell detection** — block or confirm risky commands
5. **Secret redaction** — strip keys from debug logs
6. **Git checkpoints** — stash before first edit in a turn
7. **Agent loop limits** — cap turns, tool calls, repeated failures
8. **Unicode sanitization** — strip hidden characters from file reads (Blink runtime)

---

## API keys and secrets

### Storage

| File | Permissions | Contents |
|------|-------------|----------|
| `~/.blink/providers.json` | **0o600** (owner read/write only) | Provider keys, models, endpoints |
| `~/.blink/api-key` | **0o600** | Legacy FreeModel key (migrated to providers.json) |
| `~/.blink/agent/*.json` | **0o600** | Agent session state |

Keys are never written into the npm package or committed to git by Blink itself.

### What is never printed

- `blink config` and `blink config --json` show `apiKeyConfigured: true/false`, not key values
- `blink doctor` shows provider label, not keys
- Environment overrides report `BLINK_API_KEY: true`, not the value

### Log redaction

When `BLINK_SRC` or `BLINK_PACKAGE_ROOT` is set (normal Blink runs):

- **Debug logs** (`logForDebugging`, `--debug`) redact API keys, bearer tokens, env assignments
- **Tool logs** redact inputs and errors via `services/blink/tools/safety.ts`
- Patterns include: `fe_oa_…`, `sk-ant-…`, `sk-…`, `ghp_…`, `AKIA…`, `Bearer …`, `KEY=value`

Redaction applies to debug output — not to intentional key entry via `blink auth login`.

---

## Shell command safety

### Destructive command blocking

In Blink runtime, these patterns trigger **ask** (user confirmation) unless `/bypass` mode is active:

| Pattern | Example |
|---------|---------|
| Recursive force delete | `rm -rf`, `rm -r -f` (any flag order) |
| Force push | `git push --force`, `git push -f` |
| Hard reset | `git reset --hard` |
| Force clean | `git clean -f` |
| Branch delete push | `git push --delete` |
| Database wipe | `DROP DATABASE`, `TRUNCATE TABLE` |
| Disk format | `mkfs`, `dd if=` |
| World-writable chmod | `chmod -R 777` |
| Pipe to shell | `curl … \| bash`, `wget … \| sh` |

Implementation: `services/blink/permissions/destructiveShell.ts`, wired in `tools/BashTool/BashTool.tsx`.

### Command injection defenses

- **Path validation** rejects `$VAR`, `%VAR%`, `$(cmd)`, tilde variants in file paths (TOCTOU gap prevention)
- **Bash security** module scans for injection patterns (`tools/BashTool/bashSecurity.ts`)
- **PowerShell path validation** on Windows (`tools/PowerShellTool/pathValidation.ts`)
- Shell commands run via controlled `exec` with timeouts, not arbitrary `shell: true` on user strings in the main bash path

### Tier gates (`acceptEdits` / plan mode)

| Mode | Shell | File edits |
|------|-------|------------|
| **Plan** | Ask / gated | Blocked (read-only) |
| **Ask / Default** | Allowlisted auto (`git`, `gh`, `npm`, …); else ask | Auto-accepted (secret paths still ask) |
| **Code / acceptEdits** | Same as Ask | Auto-accepted |
| **Bypass** | Allowed (destructive patterns still flagged unless bypass) | Allowed |

Implementation: `services/blink/permissions/toolGate.ts`.

---

## File operation safety

### Path validation

Before file tools run in Blink, paths are checked (`utils/permissions/pathValidation.ts`, `services/blink/tools/safety.ts`):

- No null bytes
- No shell expansion in paths
- No UNC credential-leak paths
- No glob patterns on write/create
- Dangerous removal targets blocked (`/`, `~`, drive roots, top-level system dirs)

### Protected files and directories

Auto-edit is restricted for sensitive paths (`utils/permissions/filesystem.ts`):

- `.git`, `.env`, `.ssh`, shell rc files, `.mcp.json`, etc.
- See `DANGEROUS_FILES` and `DANGEROUS_DIRECTORIES` in that module

### Overwriting work

- **Git checkpoint** before first Edit/Write in an assistant turn: stashes uncommitted changes as `blink-checkpoint` (`services/blink/git/checkpoint.ts`)
- **Permission prompts** for secret paths and non-allowlisted / destructive shell
- **Plan mode** prevents writes entirely

### Unicode / prompt injection from files

In Blink runtime, **file read content** is passed through `partiallySanitizeUnicode()` to remove hidden Unicode tag characters and direction overrides that could inject instructions into the model (`tools/FileReadTool/FileReadTool.ts`).

MCP tool definitions are similarly sanitized (`services/mcp/client.ts`).

File reads also append a **malware awareness** system reminder (models are instructed not to augment malicious code).

---

## Auto-apply behavior

| Setting | Behavior |
|---------|----------|
| **Default (Ask)** | Auto-accepts file edits + allowlisted shell; prompts for unusual/destructive commands and secret paths |
| **`/code` / acceptEdits** | Same as Ask for edits; allowlisted shell auto-runs |
| **`/bypass` / yolo** | Auto-accepts tools; destructive shell still prompts |
| **`--yolo` / `--dangerously-skip-permissions`** | Same as bypass at CLI start |

`acceptEdits` **blocks** shell file-creation patterns (`touch`, `echo >`, `tee`) — use Write/Edit tools instead.

---

## Agent loop limits

Active only during `/agent` sessions (`services/blink/agent/loopGuard.ts`):

| Limit | Default |
|-------|---------|
| Max turns | 50 |
| Max tool calls | 150 |
| Session timeout | 30 minutes |
| Identical failed tool calls | 3 → stop |
| Empty model outputs | 2 → stop |

The main REPL chat loop does **not** apply these limits unless an agent session is running.

---

## Web and network

- **WebFetch** blocks certain domains and egress (`tools/WebFetchTool/utils.ts`)
- **OpenAI-compat proxy** runs on localhost — keys are not sent to third-party translators for routing logic
- Use `BLINK_PROXY_DEBUG=1` only in trusted environments (writes `.blink/proxy-debug.log`)

---

## What Blink cannot guarantee

- **Malicious project code** — reading `package.json` postinstall scripts or running `npm test` can still execute project code you asked for
- **Bypass mode** — `/bypass` disables most prompts; use only in sandboxes
- **Model behavior** — prompt injection from untrusted web content or clever file content may still influence the model; sanitization reduces but does not eliminate risk
- **Wrong edits** — always use git; review diffs in plan/code workflows

---

## Reporting issues

Security concerns: [GitHub Issues](https://github.com/itsdexy/BlinkCode/issues) (mark as security-sensitive if applicable).

---

## Related code

| Area | Path |
|------|------|
| Tool safety helpers | `services/blink/tools/safety.ts` |
| Destructive shell | `services/blink/permissions/destructiveShell.ts` |
| Permission tiers | `services/blink/permissions/toolGate.ts` |
| Path validation | `utils/permissions/pathValidation.ts` |
| Log redaction | `bridge/debugUtils.ts`, `utils/debug.ts` |
| Provider key storage | `scripts/blink-providers.js`, `scripts/blink-save-api-key.js` |
| Git checkpoint | `services/blink/git/checkpoint.ts` |
| Agent limits | `services/blink/agent/loopGuard.ts` |
| Unicode sanitization | `utils/sanitization.ts` |

Tests: `bridge/debugUtils.test.ts`, `services/blink/tools/safety.test.ts`, `services/blink/permissions/destructiveShell.test.ts`, `scripts/blink-cli.integration.test.ts`.
