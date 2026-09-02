# Tovyr Application Adapters Design

**Date:** 2026-08-27
**Status:** User-approved design; ready for review before implementation
**Parent:** `2026-08-26-tovyr-unified-ai-platform-design.md`

## Goal

Make Tovyr the single local model gateway for the developer applications that
can use a custom model endpoint. A user connects providers and models in
Tovyr, then discovers, launches, configures, validates, disconnects, and
restores supported client integrations from one command surface.

The implementation must support the clients named for this release: Codex,
ChatGPT Desktop's Codex view, Claude Code, Claude Desktop, OpenCode, Hermes
Agent, OpenClaw, Droid, Pi, Kimi, and Copilot CLI. A generic OpenAI-compatible
connection recipe is available for other compatible clients.

## Product boundary

There are two different kinds of integration and the CLI must say which one a
client gets:

1. **Model-routing integration** sends model requests to Tovyr's loopback
   gateway. It requires a client that exposes a custom OpenAI-, Anthropic-, or
   Ollama-compatible endpoint.
2. **Tool integration** connects Tovyr through MCP or the client's extension
   mechanism. It adds tools or data but does not replace the application's
   hosted chat model.

Codex, ChatGPT Desktop's Codex view, Claude Code, and OpenAI-compatible
clients can use model routing when their installed version exposes the needed
contract. Official Claude Desktop and ChatGPT's normal Chat/Work views are
tool-only: their model backends are not configurable. They must never be
advertised as Tovyr-model-routing clients.

## Architecture

```text
Tovyr provider/model state
          |
          v
Tovyr gateway  (/v1, /v1/messages, /api)
          |
          +-- ApplicationManager
                 |
                 +-- ApplicationAdapter manifests
                 |      discovery, capabilities, setup, launch, validation
                 |
                 +-- ConfigTransaction
                 |      backup, Tovyr-owned patch, validation, restore
                 |
                 +-- Model chooser
                        connected Tovyr models only
```

The existing gateway remains the only route to providers. Application adapters
must not store providers, provider keys, duplicated model catalogues, or an
independent server. A client receives a qualified model ID such as
`nvidia_nim::moonshotai/kimi-k3`; the gateway resolves it through the shared
Tovyr provider state.

## Adapter contract

Every adapter declares:

- stable ID, display name, supported platforms, and integration kind;
- executable and version detection;
- protocol family and model/tool capability requirements;
- verified configuration targets and Tovyr-owned fields, if any;
- launch command or environment overlay, if applicable;
- validation steps and recovery instructions;
- detection state: `ready`, `manual-setup`, `tool-only`, `missing`, or
  `unsupported-version`.

`ready` is reserved for adapters with a tested configuration or launch path.
When an application does not offer a custom endpoint, its adapter reports the
real limitation and offers its MCP/tool route rather than creating a fake
configuration file.

## CLI contract

```text
tovyr apps list                 # adapters and their real readiness
tovyr apps status [app]         # gateway, executable, config, model checks
tovyr apps configure <app>      # preview/apply only verified Tovyr-owned config
tovyr apps launch <app>         # choose a Tovyr model, start/reuse gateway, launch
tovyr apps disconnect <app>     # remove Tovyr-owned configuration only
tovyr apps restore <app>        # restore the recorded pre-Tovyr backup
tovyr apps doctor [app]         # targeted diagnostics and recovery steps
```

The short forms (`tovyr codex`, `tovyr claude`, and `tovyr chatgpt`) stay as
aliases over the same manager. `apps list` always works without a model picker.
Model selection appears only for a routing launch or a model-specific
configuration action, and lists only currently connected models.

## Configuration and safety

- Tovyr uses only loopback endpoints by default: `127.0.0.1:11434`.
- Provider credentials remain in Tovyr. An adapter receives a scoped Tovyr
  gateway token only when the client requires one; loopback access remains
  compatible with local clients.
- Before modifying a verified client config, Tovyr creates a timestamped,
  owner-only backup and a small ownership manifest under `~/.tovyr/apps/`.
- Patching is idempotent and limited to fields the adapter owns. Validation
  failure restores the backup automatically.
- `disconnect` and `restore` never delete user settings, credentials, or other
  client entries.
- Launches use argument arrays and the project launch directory. No adapter
  interpolates a model ID, token, or path into a shell command.

## Release slices

### Slice 1 — manager foundation and verified routes

Create the adapter registry, status model, connection manifest, backup
transaction, `apps` commands, shared model picker, and generic endpoint
recipe. Migrate the current Codex, ChatGPT Desktop, and Claude Code launchers
to those shared services without changing their successful behavior.

### Slice 2 — desktop and MCP routes

Add formal adapters for Claude Desktop and ChatGPT Desktop. Their status makes
the model-routing boundary explicit and offers an MCP/tool connection route.
On Windows, ChatGPT Desktop discovery uses its installed AppX package
(`OpenAI.Codex`) rather than the older standalone-desktop detector.

### Slice 3 — external coding clients

Research each current official configuration contract, then add verified
adapters for OpenCode, Hermes Agent, OpenClaw, Droid, Pi, Kimi, and Copilot
CLI. Each adapter is released only after fixture coverage proves discovery,
configuration/launch, and a gateway model-list smoke test. Clients without a
stable custom-endpoint setting receive a manual or tool-only adapter state,
not an unsupported claim.

### Slice 4 — hardening

Add conflict detection, rollback, command help, doctor output, Windows/macOS/
Linux discovery tests, and redacted diagnostics. Add live-provider smoke tests
only as opt-in checks.

## Testing

- unit-test adapter manifests, status resolution, model filtering, and command
  parsing;
- test config transactions against fixture homes: create, repeat, validation
  failure rollback, disconnect, and restore;
- use fake OpenAI and Anthropic upstreams to prove a selected model streams
  through the gateway;
- test each client adapter with representative executable/config fixtures;
- retain a Windows test for the Microsoft Store ChatGPT package discovery;
- run focused adapter/gateway tests and `npm run typecheck:tovyr` after every
  vertical slice.

## Acceptance criteria

1. `tovyr apps list` reports every named client with an honest capability and
   readiness state.
2. A ready routing adapter can launch or configure its client against the
   running Tovyr gateway and see connected Tovyr models.
3. Tool-only desktop adapters never claim to replace their hosted chat model.
4. Every config edit has a safe backup, validation, disconnect, and restore
   path.
5. A broken or absent application leaves the user's configuration untouched
   and produces a concrete recovery command.
6. No provider key, gateway token, or unrelated user setting is exposed in
   config output, logs, test fixtures, or the repository.
