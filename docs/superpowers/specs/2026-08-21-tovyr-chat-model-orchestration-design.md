# Tovyr Chat, Model Reliability, and Orchestration Design

**Date:** 2026-08-21  
**Status:** Awaiting user review  
**Scope:** Interactive Tovyr chat UI, provider/model activation, model readiness, and optional multi-model execution

## Goal

Make Tovyr feel like a fast, deliberate terminal product while ensuring every selectable model has an honest, actionable status. Normal chat remains focused and lightweight. Complex implementation work may use separate planning, building, and verification models without hiding which model is responsible for each phase.

The approved visual direction is kinetic while work is active and quiet when work is complete. It uses strong typography, compact state-driven animation, and a single live activity surface. It does not use robot faces, sparkles, glowing orbs, fake glass, or generic AI-assistant iconography.

The same release completes the migration from the retired product name to Tovyr and makes `https://github.com/itzdexy/Tovyr` the canonical repository URL.

## Product Identity Migration

All maintained product-owned surfaces use `Tovyr` and `tovyr` consistently. The migration covers:

- User-facing UI, help, errors, status text, prompts, and notifications.
- Source identifiers, product-owned component and module names, filenames, directories, scripts, and generated artifacts where the old name still carries product meaning.
- CLI commands, launcher names, package metadata, executable names, configuration documentation, examples, and install instructions.
- Repository, issue, homepage, clone, update, release, security-reporting, and source-link URLs.
- Tests, snapshots, fixtures, migration documents, comments, and developer documentation that would otherwise keep the legacy product name active.
- The current local branch and Git remote metadata when they encode the legacy or incorrect product identity.

The canonical repository owner and URL are exactly `itzdexy/Tovyr` and `https://github.com/itzdexy/Tovyr`. Package metadata uses the corresponding Git URL, issue URL, and README homepage.

Compatibility aliases may retain an old machine-readable key only when removing it would break an existing installation or persisted user configuration. Such aliases must be isolated in a documented migration boundary, must not appear in normal UI or new documentation, and must have tests proving that new writes use Tovyr naming. Git history, third-party dependencies, external protocol field names, and unrelated uses of the English word “blink” are not rewritten.

A repository-wide brand check fails when a retired product reference or a stale Tovyr repository URL appears outside the explicit compatibility allowlist.

## Evidence and Current Problems

The focused Tovyr test suite currently passes, but the live provider path exposes gaps that unit tests do not cover:

- A configured NVIDIA NIM model was present in `GET /v1/models`, but a real chat probe timed out.
- The provider connection snapshot still reported `ready` because the inventory endpoint was reachable.
- Picker copy calls inventory entries `live`, which implies chat and tool readiness that has not been established.
- Model activation is inconsistent. The footer selector probes before activation, while the provider picker activates and hot-applies the candidate before probing, then attempts a rollback.
- Capability inference treats most unknown text-generation model IDs as tool-capable. Inventory APIs can include base, completion, vision, embedding, safety, and other models that are not suitable coding agents.
- Thinking, spinner, tool, and status components can compete for attention instead of presenting one coherent turn state.

These problems share one root cause: provider reachability, model discoverability, chat readiness, and agent suitability are represented as if they were the same fact.

## Product Principles

1. **Chat first.** Ordinary conversation uses one model and one uncluttered transcript.
2. **State must be truthful.** “Listed” never means “ready.” Readiness must name the layer that was actually verified.
3. **Selection is transactional.** A failing candidate cannot replace a working model.
4. **Motion explains work.** Animation appears only while a real state is changing and respects reduced-motion and colorless terminals.
5. **One active surface.** A turn has one activity surface that may show thinking, search, tools, handoff, or verification.
6. **Evidence over theater.** Completed activity collapses into useful proof: sources, files, commands, tests, and model handoffs.
7. **Orchestration is proportional.** Multi-model execution is reserved for work that benefits from independent planning or verification.
8. **Providers keep their identity.** Tovyr branding never renames a third-party model family or vendor.

## Information Architecture

### Default chat

The persistent interface contains:

- A compact header with Tovyr, project, branch, and indexing state.
- The transcript, optimized for reading rather than card stacking.
- At most one live activity surface for the current turn.
- A composer with the active mode and provider/model in the footer.

Normal chat does not show orchestration controls.

### Orchestrated run

When orchestration is active, a compact rail appears between the header and transcript:

`PLAN <model> → BUILD <model> → VERIFY <model>`

Each phase has a textual state such as `waiting`, `working`, `complete`, `needs changes`, or `failed`. Color reinforces the state but is never the only signal. The rail supports keyboard focus so the user can inspect evidence, pause, redirect, or replace a role model.

When the run ends, the rail collapses into a one-line handoff summary in the transcript.

### Model picker

The picker groups models by readiness rather than presenting a flat catalog:

- **Ready:** chat verified; agent tool behavior verified or explicitly supported.
- **Chat only:** chat verified but tool use is unsupported or unverified.
- **Slow:** the provider is reachable but the model exceeded the probe budget.
- **Unavailable:** the model returned a hard model or endpoint error.
- **Unsuitable:** the inventory item is not an agent chat target.
- **Unverified:** a curated fallback shown when discovery is unavailable.

Copy uses “listed” or “discovered” for inventory results. The word “live” is reserved for a successful inference response.

### Model naming

Model identity and application identity are separate:

- Anthropic models render as `Claude Opus 5`, `Claude Sonnet 5`, `Claude Haiku 4.5`, and so on.
- OpenAI, Google, xAI, Meta, Mistral, and other provider models retain their provider-owned public names.
- Tovyr appears as the application name and may appear in names of Tovyr-owned services such as TovyrRoute. It is never substituted for `Claude` or another provider name.
- Provider wire IDs remain exact and are never rewritten for display branding.
- One canonical model-display formatter is used by the model explorer, `/model`, `/provider`, footer, status line, orchestration rail, confirmations, and error messages.
- The formatter derives a safe provider name from structured provider metadata or a recognized wire ID when catalog or registry labels are incomplete. For example, a registry entry with upstream ID `claude-opus-5` cannot render as either `Opus 5` or `Tovyr Opus 5`; it renders as `Claude Opus 5`.

Catalog and registry data should store provider-correct display names. The formatter remains a defensive boundary for signed registries, cached data, custom gateways, and older configuration written by prior Tovyr releases.

## Turn Activity Design

### State model

The live activity surface is driven by actual runtime events:

- `thinking`
- `searching`
- `reading_source`
- `running_tool`
- `waiting_for_permission`
- `handoff`
- `verifying`
- `recovering`
- `failed`
- `complete`

Only one top-level state is rendered at a time. Supporting events appear as compact trace rows within that surface.

### Motion

- Thinking uses a restrained pulse or scanning line with elapsed time.
- Web search shows real stages: query issued, result count, source reading, synthesis.
- Tool execution uses a single progress marker and the current action.
- Model handoff animates once between named roles and models.
- Failure stops motion immediately and presents the recovery action.
- Completion collapses the surface into a static evidence line after a short transition.

Animation must not fabricate progress. If the runtime has no new event, the UI may show elapsed time but must not invent changing labels, files, sources, or percentages.

`NO_COLOR`, `TERM=dumb`, `CI`, reduced-motion settings, and narrow terminals receive static textual equivalents.

### Component boundary

`TovyrChatDock` remains the integration point above the composer. A focused activity-state adapter converts query, streaming, tool, search, permission, and orchestration events into one `TovyrTurnActivity` view model. The renderer consumes that view model and does not infer runtime behavior from message text.

Existing thinking and tool transcript components remain responsible for completed history. They must not render a second live spinner for the active turn.

## Model Reliability Architecture

### Separate health dimensions

Provider and model health are represented separately.

Provider connection state:

- `unconfigured`
- `checking`
- `reachable`
- `invalid_credentials`
- `limited`
- `offline`

Model readiness state:

- `unknown`
- `listed`
- `probing`
- `ready`
- `chat_only`
- `slow`
- `unavailable`
- `unsuitable`

A reachable provider with a timed-out model is `provider: reachable`, `model: slow`. It is never summarized as a ready connection.

### Readiness evidence

Each model readiness record contains:

- Provider ID and canonical model ID.
- Discovery source: provider API, signed registry, or curated fallback.
- Chat probe result and latency.
- Tool capability source: verified probe, provider metadata, curated override, or unknown.
- Context, vision, streaming, and reasoning metadata when known.
- Safe failure classification and expiration time.
- Last checked timestamp.

Hard model failures may be quarantined temporarily. Timeouts and transient network errors do not permanently hide a model.

### Transactional activation

All entry points use one model-activation service:

1. Resolve and normalize the provider/model pair.
2. Reject unsuitable inventory entries.
3. Read cached readiness or run a bounded chat probe.
4. For agent use, confirm tool support from verified metadata, a curated override, or a harmless tool-schema probe.
5. If checks pass, persist the model and hot-apply environment and session state.
6. If any check fails, leave persisted state, environment, proxy configuration, and app state unchanged.
7. Return a structured result that the picker, `/model`, `/provider`, and footer can render consistently.

Rollback is a final safety guard, not the normal activation mechanism.

### Probe policy

- Inventory requests and inference probes have separate timeouts and cache entries.
- A basic chat probe requests a very small deterministic response.
- A tool-schema probe defines a harmless synthetic function and verifies that the provider/model returns a structured tool call. It never executes a real tool.
- Probe concurrency is deduplicated per provider/model.
- Probe requests are bounded and cancellable.
- A slow result remains selectable only with an explicit warning; it is not an automatic fallback target.
- Automatic recovery selects only a ready model on the same provider unless cross-provider failover is explicitly enabled.

### Capability policy

Unknown capability is not treated as supported. Model inventory filtering uses structured provider metadata and curated overrides first, conservative ID rules second. Text-generation models without verified tools can be offered as `chat only`, but they are excluded from builder and verifier roles that require tools.

## Multi-Model Orchestration

### Triggering

Adaptive orchestration is enabled for complex implementation requests that need multiple steps, repository edits, or independent verification. Casual chat, explanations, and small changes remain single-model.

The user may explicitly enable or disable orchestration for a run. Existing plan, code, and permission modes remain authoritative:

- Plan mode is read-only and writes the approved plan to `tovyrplan.md`.
- Code and default ask mode may execute allowed edits and commands under existing permission rules.
- Bypass mode does not bypass destructive-command or secret-path protections.

### Roles

**Planner**

- Receives the goal, repository evidence, constraints, and known failures.
- Produces ordered steps, acceptance criteria, risk notes, and verification commands.
- Does not edit files.

**Builder**

- Receives the approved plan, current step, relevant context, and acceptance criteria.
- Performs scoped edits and verification for that step.
- Produces a structured handoff containing files changed, commands run, results, and unresolved concerns.

**Verifier**

- Receives the goal, acceptance criteria, diff summary, and raw test/build evidence.
- Does not inherit the builder’s claim that the work is correct.
- Returns `approved`, `needs changes`, or `blocked`, with concrete evidence.

Roles may use the same model when only one ready agent model is available. The UI says so explicitly rather than pretending the run is independently reviewed.

### Routing

The router chooses only models that are ready for the required capability set. Selection considers:

- Tool support.
- Context capacity.
- Reasoning capability.
- Latency class.
- User-configured role preferences.
- Provider availability and quota.

The initial implementation uses deterministic rules and user preferences, not another opaque model call. Role choices are shown before execution and may be changed from the run rail.

### Execution state

An orchestrated run is a persisted state machine:

`drafting_plan → awaiting_plan → building → verifying → complete`

Failure branches are `needs_input`, `needs_changes`, `model_failed`, and `blocked`. The active plan and completed evidence survive model failures and process restarts. A failed role may be retried with another ready model without replaying completed write operations.

The verifier may send work back to the builder for a bounded number of repair rounds. After the configured limit, the run stops with the remaining failures instead of looping indefinitely.

## Error and Recovery UX

Errors use a one-line summary with expandable evidence. The summary identifies the failing layer:

- Credentials
- Provider connectivity
- Quota or rate limit
- Model unavailable
- Model slow
- Tool behavior unsupported
- Context exhausted
- Stream malformed or empty
- Permission denied
- Verification failed

Every recoverable error presents the relevant next action, such as retrying, keeping the current model, choosing a ready model, compacting context, connecting a provider, or inspecting details. Tovyr never silently changes providers. Same-provider recovery may occur automatically only when the replacement is ready and the user has enabled automatic model recovery.

## Persistence and Privacy

- Provider keys and OAuth credentials remain in existing protected storage and are never included in orchestration artifacts.
- Readiness records contain no secrets or request content.
- Probe failure details are sanitized before persistence or display.
- Orchestration state lives under the project `.tovyr` directory and contains plan/evidence metadata, not credentials.
- Existing permission checks apply independently to every builder action.

## Implementation Boundaries

The implementation should introduce focused modules rather than expanding `query.ts` further:

- Model readiness records and cache.
- Transactional provider/model activation.
- Orchestration role routing and persisted run state.
- Turn activity view-model adapter.
- Kinetic terminal renderer and static accessibility fallback.

Existing provider catalog, OpenAI compatibility conversion, query engine, permission system, and `tovyrplan.md` flow remain in place and are integrated through narrow interfaces.

## Testing Strategy

### Unit tests

- Provider reachability and model readiness cannot collapse into one `ready` state.
- Inventory presence produces `listed`, not `ready`.
- Timeout produces `slow` without quarantining the model as a hard failure.
- Unsuitable and chat-only models are excluded from agent roles.
- Claude-family labels retain the `Claude` name across catalog, registry, explorer, footer, orchestration, confirmation, and error surfaces.
- Third-party model labels are never prefixed with or rewritten to `Tovyr`.
- Brand scanning rejects retired product references outside the compatibility allowlist.
- Repository-link tests require `itzdexy/Tovyr` for package metadata, docs, installers, updaters, and issue/security links.
- Transactional activation leaves all prior state unchanged after every failure stage.
- Picker, slash command, provider dialog, and footer use the same activation result.
- Activity events reduce to exactly one top-level live state.
- Reduced-motion and colorless modes render complete textual states.
- Router selects only models satisfying role capabilities.
- Repair-round limits terminate reliably.

### Integration tests

- Mock OpenAI-compatible providers for successful chat, delayed chat, missing tools, empty streams, invalid models, authentication failure, rate limit, and malformed SSE.
- Verify proxy conversion with real tool-call and reasoning delta shapes.
- Verify activation across persisted provider state, environment variables, local proxy, and app state.
- Verify an orchestrated plan/build/verify run, including a builder failure and model replacement.
- Verify restart/resume without repeating completed write actions.

### Terminal UI tests

- Snapshot wide, narrow, colorless, and reduced-motion layouts.
- Confirm the activity surface does not duplicate thinking or tool spinners.
- Confirm long model IDs, commands, and source URLs truncate without breaking layout.
- Confirm keyboard navigation for the model picker and orchestration rail.

### Live smoke checks

Live provider checks are opt-in and never required for the default test suite. For configured providers they verify model discovery, chat inference, tool-schema response, streaming, and safe failure copy without printing credentials.

## Success Criteria

- A model that merely appears in inventory is never labeled ready or live.
- A failed candidate never replaces the working model.
- All model-selection entry points behave consistently.
- A coding role never auto-selects a known chat-only or unsuitable model.
- `claude-opus-5` is displayed as `Claude Opus 5` everywhere and is never displayed as `Tovyr Opus 5`.
- Maintained product code and documentation contain no retired product name outside documented compatibility shims.
- All Tovyr-owned repository links and local Git remote metadata use `https://github.com/itzdexy/Tovyr`.
- Normal chat shows one live activity surface and no orchestration chrome.
- Web-search activity reflects real queries, results, and source reads.
- Completed work collapses to a concise evidence trail.
- Complex work can plan with one model, build with another, and verify with a third.
- Multi-model runs remain interruptible, resumable, and governed by existing permissions.
- The UI remains legible on narrow Windows terminals and with animation or color disabled.

## Non-Goals

- Replacing Ink or rewriting the entire terminal application.
- Building a free-form autonomous swarm.
- Automatically spending across providers without explicit user configuration.
- Claiming universal tool support based on model naming.
- Adding decorative animation unrelated to runtime state.
- Fixing the repository’s unrelated baseline type errors as part of this feature.
