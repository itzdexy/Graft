# Tovyr Unified AI Platform Design

**Date:** 2026-08-26  
**Status:** Approved architecture; written specification awaiting review  
**Product:** Existing Tovyr Bun/source CLI and Ink terminal application

## Objective

Evolve the existing Tovyr coding agent into one unified AI platform without
rebuilding or sidelining the working CLI. A user connects or installs a model
once in Tovyr, then uses that same model through the built-in Tovyr agent and
supported external applications such as Claude Desktop, Claude CLI, Codex,
OpenCode, Hermes Agent, OpenClaw, Droid, Pi, and Copilot CLI.

Tovyr owns the source of truth for providers, models, capabilities, health,
routing, gateway access, application configuration, and platform settings.
External applications remain independent clients of that shared core.

## User and Job to Be Done

The primary user is a developer who wants local and cloud models to work across
multiple AI coding applications without separately managing provider URLs,
model identifiers, credentials, compatibility proxies, or application-specific
configuration.

The core job is:

> Configure a provider or local runtime once, choose a model, and safely use it
> from Tovyr and other supported AI applications through one dependable local
> gateway.

## Existing Context

Tovyr is already a working interactive coding agent. The existing experience
remains the foundation and a first-class platform client.

### Live components to preserve

- `bin/tovyr.js` and `entrypoints/cli.tsx` provide the npm/source launch path,
  Windows handling, early input capture, and warm runtime behavior.
- `main.tsx`, `screens/REPL.tsx`, `components/App.tsx`, and the Ink design
  system provide the CLI and terminal interface.
- `query.ts`, `QueryEngine.ts`, `services/api/claude.ts`, and
  `services/tools/**` provide the interactive model/tool loop and streaming.
- `commands.ts` and `commands/**` provide slash-command discovery and actions.
- `scripts/tovyr-providers.js` and the provider catalog provide the live
  provider/model state used throughout Tovyr.
- `services/tovyr/providers/probe.ts`, provider-model caches, readiness,
  activation, and failover modules provide real health and model behavior.
- `services/tovyr/openAiCompat/**` provides working OpenAI-to-Anthropic
  compatibility for the current agent engine.
- `tools.ts`, `Tool.ts`, `services/mcp/**`, and the permission system provide
  tool execution, MCP, and safety gates.
- `utils/sessionStorage.ts` and agent persistence provide conversations,
  resume, forks, and project-scoped state.
- `utils/config.ts`, `utils/settings/**`, and `components/Settings/**` provide
  the existing settings architecture.
- Existing updater, build, Bun runtime, npm packaging, and release checks remain
  authoritative.

### Components that are not production foundations

The following top-level modules contain simulated or disconnected managers and
are not used by the live Tovyr request path:

- `providers/ProviderAbstraction.ts`
- `providers/HealthChecker.ts`
- `local/LocalModelSupport.ts`
- `backend/MultiBackendSupport.ts`
- `architecture/ClientServerArchitecture.ts`
- simulated portions of `updates/**`

They must not become parallel sources of truth. Useful types or algorithms may
be migrated into the live platform core only after tests establish real
behavior; otherwise the modules should be retired.

`packages/tovyrroute/` is an ignored, untracked OmniRoute-derived application
with separate providers, credentials, storage, server, dashboard, CLI, and
tests. It may be consulted for protocol behavior and fixtures, but it must not
ship as a second Tovyr application or retain independent state. Any reused code
must be extracted into focused, Tovyr-owned modules with compatible licensing,
tests, naming, and security review.

## Architectural Decision

Use an incremental strangler migration around Tovyr's working provider state.
Typed platform services are introduced in front of the live implementation,
the built-in agent migrates to those services, and the public gateway is then
added as another consumer.

Rejected alternatives:

1. Embedding TovyrRoute wholesale would duplicate provider, credential,
   configuration, UI, and lifecycle ownership.
2. Running a permanently separate gateway sidecar would preserve two routing
   architectures and make the built-in agent a special case.
3. Rewriting the agent and CLI would discard working tools, sessions,
   permissions, streaming, and Windows behavior without architectural need.

## Target Architecture

```text
                       TOVYR PLATFORM CORE

 ProviderRegistry ─ ModelRegistry ─ CredentialStore ─ CapabilityRegistry
         │                 │                 │                 │
         └─────────────────┴──────────┬──────┴─────────────────┘
                                      │
                                ModelRouter
                                      │
                              ProviderAdapter
                                      │
             ┌────────────────────────┼────────────────────────┐
             │                        │                        │
       Local runtimes           Cloud providers       Custom endpoints
   Ollama / LM Studio       FreeModel / Anthropic    OpenAI-compatible
             │                        │                        │
             └────────────────────────┼────────────────────────┘
                                      │
                         Normalized request/event API
                                      │
                 ┌────────────────────┼────────────────────┐
                 │                    │                    │
          Built-in agent       Gateway protocols      Settings / CLI
                                      │
                OpenAI Chat + Responses + Anthropic Messages
                                      │
      Claude Desktop / CLI · Codex · OpenCode · Hermes Agent
        OpenClaw · Droid · Pi · Copilot CLI · future adapters
```

## Core Domain Model

### ProviderDefinition

Describes a provider without containing secrets:

- stable provider ID and display name;
- provider kind: local, cloud, gateway, or custom;
- supported wire protocols;
- default endpoint and user-overridable endpoint;
- authentication modes;
- model discovery method;
- static capability hints;
- setup and troubleshooting metadata.

The existing provider catalog becomes the initial backing data. Catalog data,
live connectivity, credentials, and user selection remain separate concepts.

### ProviderConnection

Represents user-owned provider configuration:

- provider ID;
- endpoint override;
- secret reference rather than plaintext secret in normal service objects;
- authentication mode;
- connection state and last checked time;
- safe diagnostic details;
- provider-specific non-secret options.

### ModelDescriptor

Uses and extends the existing typed descriptor:

- provider-qualified stable identity;
- upstream model ID and display name;
- availability and lifecycle;
- context and output limits;
- streaming, tool, vision, reasoning, and modality capabilities;
- pricing metadata when known;
- discovery source and last verification time.

No model is reported as capable merely because a static catalog lists it. Live
verification takes precedence, followed by signed metadata, catalog data, and
clearly marked inference.

### ModelSelection

Selections are provider-qualified. The same upstream model string on different
providers is not the same selection. Activation is transactional: validate,
probe when appropriate, persist atomically, update process/session state, and
retain the previous working selection when activation fails.

### NormalizedModelRequest

The internal request is protocol-neutral and supports:

- ordered system/user/assistant/tool messages;
- text and supported media content;
- tool schemas and tool choice;
- reasoning/effort hints;
- sampling and token limits;
- streaming preference;
- caller metadata and cancellation;
- requested provider/model or routing policy.

### NormalizedProviderStreamEvent

The existing normalized event direction is retained and completed for text,
reasoning, tool calls, tool results, usage, quota, errors, and completion. Both
the built-in agent and gateway protocol encoders consume these events.

## Platform Services

### ProviderRegistry

Wraps the existing catalog and provider state behind typed operations. During
migration, `scripts/tovyr-providers.js` remains the persistence implementation;
callers move to the registry incrementally. There is one active provider/model
source of truth, not synchronized copies.

### CredentialStore

Provides scoped read/write/delete operations for provider and gateway secrets.
It preserves existing `~/.tovyr` migration behavior and supports OS secure
storage when available. Plaintext fallback files require owner-only permissions.
Secrets never appear in logs, diagnostics, app-generated config, process titles,
or command output.

External application credentials remain independent. Tovyr changes only the
endpoint, model, and generated Tovyr gateway token fields it owns.

### ModelRegistry

Merges curated, discovered, cached, and signed model metadata; records
verification evidence; and produces filtered model lists for Tovyr and gateway
clients. It replaces direct catalog traversal in UI consumers over time.

### ProviderAdapter

Each adapter implements authentication, model discovery, probing, normalized
streaming, error normalization, and quota extraction. Initial adapters cover:

1. Ollama through its OpenAI-compatible local endpoint;
2. FreeModel through the existing Tovyr/Anthropic-compatible path;
3. a configurable OpenAI-compatible endpoint.

Additional existing catalog providers are onboarded by protocol family rather
than by copying request code for every provider.

### ModelRouter

Routes an explicit provider/model selection by default. Automatic cross-provider
failover remains opt-in. The router uses capability compatibility, reachability,
quota, model readiness, and user policy. It never silently bypasses an auth
failure or changes persisted selection during a one-request fallback unless the
user explicitly activates the new selection.

### LocalRuntimeManager

The first release discovers and orchestrates installed Ollama and LM Studio
runtimes. It can:

- detect executable/server availability;
- start or connect to a runtime when authorized;
- list installed/loaded models;
- pull supported Ollama models with real progress;
- load, unload, or delete models where the runtime supports it;
- report CPU/GPU/memory facts without fabricated capacity;
- expose runtime logs and recovery actions.

Downloading or installing runtime binaries is a later, explicit operation with
platform-specific verification, checksums, license disclosure, destination
selection, and rollback. Tovyr never silently installs a runtime.

## Gateway

### Command and lifecycle

`tovyr serve` starts the compatibility gateway from the existing Tovyr CLI.
There is no separate product binary or configuration root.

Default behavior:

- bind only to `127.0.0.1` and `::1` where supported;
- choose a documented stable default port with an explicit override;
- reuse the shared platform services and provider/model state;
- provide graceful shutdown and stale-process recovery;
- surface status through `tovyr serve status`, `tovyr apps`, and settings;
- never launch `tovyr.exe`; use the Bun/source CLI and normal launchers.

Remote or LAN binding is disabled by default and requires an explicit bind
address, authentication, and a visible security warning.

### Authentication

The gateway generates separate revocable tokens for managed application
connections. Tokens are stored through `CredentialStore`, displayed only when
required, and passed to applications through their supported secret mechanism.
Loopback requests may still require tokens so another local process cannot
silently consume paid providers.

### Initial protocol surface

- `GET /health` and `GET /v1/models`;
- `POST /v1/chat/completions`, streaming and non-streaming;
- `POST /v1/responses`, streaming and non-streaming;
- `POST /v1/messages`, streaming and non-streaming.

The first implementation must preserve text, system prompts, tool definitions,
tool calls, tool results, finish reasons, cancellation, usage, model identity,
and safe errors. Unsupported protocol fields return explicit compatibility
errors or documented omissions; they are not silently accepted and discarded.

### Request path

1. Authenticate and identify the calling application.
2. Validate body size, protocol schema, model request, and media limits.
3. Resolve the app's model alias or explicit provider-qualified model.
4. Check model capabilities against requested tools/media/reasoning.
5. Normalize the protocol request.
6. Route through the same `ModelRouter` and `ProviderAdapter` used by Tovyr.
7. Encode normalized events back into the caller's protocol.
8. Record bounded, redacted operational evidence.

## Built-in Agent Migration

The built-in coding agent becomes a platform-core client without changing its
user-visible workflow.

The migration preserves:

- bare `tovyr` interactive startup;
- slash commands and prompt behavior;
- system/context construction;
- tool schemas, execution, and permission requests;
- MCP integrations;
- streaming rendering and one live activity row;
- conversation persistence, resume, compaction, and forks;
- provider failover policy and watchdog behavior;
- usage/cost accounting where metadata exists;
- Ask, Plan, Code, Bypass, and Superthink modes.

The migration first introduces an engine-facing client interface. The existing
Anthropic path implements that interface before other adapters are enabled. The
agent then consumes normalized events, allowing the existing OpenAI translation
proxy to be reduced or removed only after equivalence tests pass.

## Application Manager

### Commands

```text
tovyr apps
tovyr apps status
tovyr install <app>
tovyr configure <app>
tovyr launch <app>
tovyr disconnect <app>
tovyr restore <app>
```

`install` means install the application when an adapter supports a trustworthy
platform-native installer, then configure it. If safe unattended installation
is unavailable, Tovyr clearly separates installation instructions from the
configuration it can perform.

`launch` verifies the gateway, provider, model, application executable, and
managed config before spawning the application from the user's project working
directory.

### ApplicationAdapter contract

Each adapter defines:

- stable application ID, display name, and supported platforms;
- executable discovery and version probing;
- supported gateway protocols and capabilities;
- config file discovery;
- a parser and formatter that preserve unrelated user settings;
- generated configuration fields owned by Tovyr;
- environment variables and launch arguments;
- validation and health checks;
- backup, rollback, disconnect, and restore behavior;
- documentation links and unsupported-version guidance.

### Configuration transactions

Before editing an application config, Tovyr:

1. resolves and validates the exact target path;
2. parses the existing file without discarding comments when its format permits;
3. records a timestamped backup and ownership manifest;
4. computes and displays the intended managed-field change when interactive;
5. writes atomically;
6. reparses and validates the result;
7. restores the backup automatically if validation fails.

Repeated configuration is idempotent. `disconnect` removes only Tovyr-owned
fields where possible. `restore` can recover the last known pre-Tovyr config.

### Initial application adapters

The first supported set is:

- Claude Desktop;
- Claude CLI / Claude Code;
- Codex CLI;
- OpenAI/ChatGPT-compatible configurable clients where local endpoints are
  supported;
- OpenCode;
- Hermes Agent;
- OpenClaw;
- Droid;
- Pi;
- Copilot CLI.

Support is capability- and version-gated. An adapter is not advertised as ready
until executable discovery, configuration, launch, protocol negotiation, and a
smoke request have passing tests or verified platform evidence.

Adapters live in Tovyr's application-integration service, not as independent
CLIs. Future adapters can be added through a typed manifest/plugin boundary
after the built-in contract stabilizes.

## CLI and Settings Integration

The existing two-stage CLI is retained for startup performance but command
ownership is clarified:

- lightweight Node launcher handlers may dispatch fast status/config commands;
- Commander owns full application commands;
- both call the same service functions and schemas;
- no command maintains its own provider or application state.

The existing settings surface gains sections using current Ink patterns:

- General;
- Agent;
- Models: installed, discover, capabilities, local runtime;
- Providers: connections, credentials, endpoints, health;
- Applications: detected, connected, launch, restore;
- Gateway: status, address, protocols, tokens, remote-access policy;
- Performance: hardware, runtime, loading, concurrency, memory;
- Storage: models, cache, sessions, backups, logs;
- Security: tokens, bind policy, secret storage, configuration ownership.

Narrow terminals continue to use focused overlays; new settings do not create a
separate dashboard application.

## State and Migration

The migration starts from existing `~/.tovyr/providers.json` and Tovyr settings.
New schema versions are explicit and migrations are:

- idempotent;
- atomic;
- backed up before destructive shape changes;
- tolerant of older Tovyr versions reading unaffected fields;
- recoverable when interrupted;
- tested using isolated `TOVYR_HOME` directories.

Proposed logical state, whether stored in one or several focused files:

- providers and selected models;
- secret references;
- gateway settings and token references;
- local runtime/model inventory cache;
- application connection manifests and backups;
- capability/readiness cache with expiry;
- schema and migration version.

Project-local state contains only project-specific app launch preferences or
model aliases. Global credentials are never copied into project repositories.

## Error and Recovery Model

Errors use stable categories across the agent, gateway, CLI, and settings:

- configuration invalid;
- authentication failed;
- provider unreachable;
- provider quota/rate limited;
- model unavailable or incompatible;
- local runtime missing or stopped;
- protocol field unsupported;
- gateway authentication or bind failure;
- application missing or unsupported;
- application config conflict;
- launch failure;
- migration or storage failure.

Each user-facing error includes the failed operation, safe cause, retained state,
and a concrete recovery action. Raw upstream bodies and secrets are redacted.
Failed activation/configuration retains the last working provider, model, or app
configuration.

## Security and Privacy

- Gateway is loopback-only by default.
- Per-application gateway tokens are generated, scoped, revocable, and redacted.
- Remote binding is explicit and authenticated.
- Requests enforce body, media, tool-schema, concurrency, and timeout limits.
- Provider keys are never written into managed application configs when a Tovyr
  gateway token can be used instead.
- Config targets are resolved without unsafe globs or cross-shell path passing.
- Symlinks, external paths, secret locations, and ownership conflicts receive
  explicit handling.
- Application launches use argument arrays rather than interpolated shell
  strings wherever possible.
- Gateway logs default to metadata and safe diagnostics, not prompt contents.
- Telemetry remains opt-in and does not include credentials or raw prompts.
- Downloaded runtimes and models expose source, license, size, checksum when
  supplied, and storage destination before installation.

## Performance and Reliability

- Bare `tovyr` startup must not synchronously start the gateway or probe every
  provider.
- Gateway and local-runtime services load lazily when used or explicitly enabled.
- Model catalogs and capability evidence use bounded caches with visible age.
- Streaming applies first-response and idle watchdogs with cancellation
  propagated to upstream adapters.
- Backpressure prevents slow clients from causing unbounded buffering.
- Gateway shutdown drains or cancels active requests within a bounded period.
- App launches detect an already healthy gateway instead of spawning duplicates.
- Service locks and process metadata prevent stale-port and double-start races.

## Delivery Program

The platform is delivered as independently verifiable vertical slices.

### Program 1: Shared core and proof gateway

- Introduce typed registries and the engine-facing client boundary over current
  provider state.
- Implement Ollama, FreeModel, and configurable OpenAI-compatible adapters.
- Migrate one complete built-in agent request path to the shared core.
- Add authenticated loopback gateway health, models, OpenAI Chat Completions,
  Responses, and Anthropic Messages endpoints.
- Prove the built-in agent and gateway use the same active provider/model and
  capability evidence.

### Program 2: Local runtime and model manager

- Detect Ollama and LM Studio.
- List, pull, load, unload, and delete models where supported.
- Add hardware/storage checks and real progress.
- Integrate `/model`, CLI commands, and settings.

### Program 3: Application manager foundation

- Add the adapter contract, config transactions, backup manifest, token
  provisioning, validation, launch orchestration, and restore.
- Implement two representative adapters first: one Anthropic-protocol client
  and one OpenAI-protocol client.

### Program 4: Application adapter expansion

- Add and verify Claude Desktop, Claude CLI, Codex, OpenCode, Hermes Agent,
  OpenClaw, Droid, Pi, Copilot CLI, and compatible ChatGPT-style clients.
- Gate support by version and platform evidence.

### Program 5: Unified settings and operations

- Add Models, Providers, Applications, Gateway, Performance, Storage, and
  Security sections.
- Add diagnostics, token rotation, connection recovery, and storage management.

### Program 6: Hardening and release

- Complete migrations, upgrade/downgrade compatibility, load and soak tests,
  Windows launch tests, protocol fixtures, security review, packaging checks,
  documentation, and staged release controls.

Each program receives its own implementation plan. Later programs depend on the
public interfaces produced by earlier ones, not their internals.

## Testing Strategy

### Unit and contract tests

- Registry merge precedence and state migrations;
- credential redaction and secret-reference behavior;
- model identity, aliases, and capability negotiation;
- adapter request/event normalization;
- router and failover policy;
- OpenAI Chat, Responses, and Anthropic protocol conversion;
- app config patching, idempotency, conflict detection, and rollback;
- token generation, rotation, and authorization;
- local-runtime process and model lifecycle parsing.

### Integration tests

- Isolated Tovyr home with existing provider-state migration;
- fake Ollama/OpenAI/Anthropic upstream servers with streaming and tool calls;
- built-in agent and gateway requests sharing one selection;
- cancellation, timeout, backpressure, quota, malformed streams, and recovery;
- gateway start/status/stop and stale-process handling;
- application configuration against fixture homes and Windows paths;
- repeated configure/disconnect/restore cycles;
- CLI launcher and Commander paths calling the same services.

### End-to-end tests

- `tovyr` still launches the existing interactive agent;
- `tovyr serve` exposes authenticated loopback endpoints;
- an Ollama model answers through Tovyr and at least one external app fixture;
- FreeModel and a custom OpenAI endpoint answer through both consumers;
- tool calls survive protocol conversion and execute in the client that owns
  the tools;
- app launch uses the project working directory and preserves unrelated config;
- Windows PowerShell launchers work without `tovyr.exe`.

Live-provider tests are opt-in and never require committed credentials.

## Acceptance Criteria

The full program is complete when:

1. Bare `tovyr` retains the normal interactive coding-agent experience.
2. The built-in agent and gateway demonstrably share provider, model,
   capability, credential-reference, health, and routing services.
3. Ollama, FreeModel, and arbitrary OpenAI-compatible endpoints work through
   the shared core with streaming and tool-call coverage where supported.
4. `tovyr serve` supports the initial OpenAI and Anthropic protocol surface,
   uses per-app authentication, and binds only to loopback by default.
5. Local runtimes and models can be discovered and managed without fabricated
   state or silent binary installation.
6. Every advertised application adapter can detect, configure, validate,
   launch, disconnect, and restore on its supported platforms.
7. Application configuration is atomic, idempotent, minimally invasive, and
   recoverable from backups.
8. Settings expose real state for models, providers, applications, gateway,
   performance, storage, and security using the existing Tovyr visual language.
9. Secrets and gateway tokens do not leak through config output, logs, errors,
   telemetry, tests, npm artifacts, or repositories.
10. Focused tests, full Tovyr quality gates, source packaging checks, and
    Windows launcher verification pass with fresh evidence.

## Non-Goals

- Rebuilding the coding agent, TUI, session store, tools, MCP, or permission
  system from scratch.
- Shipping TovyrRoute or another gateway as an independent end-user product.
- Maintaining separate provider/model state for the agent and gateway.
- Silently installing runtimes, applications, or models.
- Copying provider credentials into third-party application configuration.
- Claiming support for an application based only on a plausible config format.
- Enabling unauthenticated LAN or internet gateway access by default.
- Replacing third-party applications' own tools, sessions, or user accounts.
- Guaranteeing that every model supports tools, vision, or reasoning; Tovyr
  reports and enforces observed capabilities.

## Implementation Constraints

- Run Tovyr through the Bun/source CLI; do not create or launch `tovyr.exe`.
- Run commands from the project working directory.
- Preserve `/model`, `/init` → `tovyr.md`, `/plan` → `tovyrplan.md`, and `/code`
  behavior.
- Preserve the active-mode prompt footer and one-live-activity-row behavior.
- Keep automatic cross-provider failover opt-in.
- Do not commit or publish API keys, tokens, credentials, or fixture secrets.
- Preserve unrelated dirty-worktree changes and avoid broad rewrites.

