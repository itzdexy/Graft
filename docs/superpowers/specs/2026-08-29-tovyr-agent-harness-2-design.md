# Tovyr Agent Harness 2 Design

**Date:** 2026-08-29  
**Status:** Approved for immediate implementation  
**Scope:** local cross-session messaging, subagent continuity, safe auto mode, frontier-model routing, terminal activity UX, and CPU/GC policy

## Outcome

Tovyr becomes a cohesive agentic coding harness instead of a collection of partially connected features. Interactive Tovyr sessions can discover and message one another, named subagents remain addressable and resumable, complex requests route across ready models by role, and auto mode provides classifier-guarded autonomy without weakening destructive-command or secret-path protections.

The live terminal follows the supplied Claude Code direction: completed tool work is compact evidence, the current action occupies one animated row, and the permission mode remains visible in the footer. Existing `TovyrActivitySurface`, compact tool rows, and footer mode badge are the rendering foundation.

## Existing Foundations

The repository already contains most of the hard runtime pieces:

- `AgentTool` supports background agents, names, transcripts, and resume.
- `SendMessageTool` supports teammates and contains unfinished UDS/bridge branches.
- `concurrentSessions.ts` writes process/session registry records.
- adaptive planner/builder/verifier orchestration is persisted under `.tovyr`.
- auto-mode classifier and permission transitions exist behind a disabled feature gate.
- the Tovyr UI already reduces live runtime state to one activity surface.
- headless mode currently forces `Bun.gc` every second, even during active work.

This release completes and connects those paths. It does not introduce a second agent framework or a second transcript renderer.

## Local Session Bus

Every interactive source-CLI process opens a local IPC endpoint:

- Windows uses a named pipe under `\\.\pipe\tovyr-<pid>-<session>`.
- Unix uses a user-only socket in the OS temporary directory.
- the endpoint is recorded in the existing session registry.
- stale registry entries are ignored and swept using the existing PID checks.

The protocol is newline-delimited JSON with a versioned envelope:

```ts
type SessionEnvelope = {
  version: 1
  type: 'message'
  id: string
  from: { sessionId: string; address: string; name?: string }
  text: string
  sentAt: string
}
```

Input is bounded to 256 KiB, validated before delivery, and converted to a visibly attributed `<cross-session-message>` user turn. Messages received while the model is busy remain queued in the existing in-memory `Mailbox` and drain when the turn is ready. The protocol is deliberately simple so another local AI agent can interoperate without importing Tovyr code.

`ListPeers` and `/peers` expose live local sessions with stable `uds:` addresses, session ID, project, status, and optional name. `SendMessage` accepts those addresses and remains read-only for local plain-text delivery. Remote bridge messages retain their existing explicit-consent boundary.

## Subagents and Orchestration

`AgentTool` remains the one subagent primitive. Named agents are registered, can receive messages during a run, and are resumed from their persisted transcript when stopped or evicted. Cross-session peers are separate from child agents but share the same discovery/address vocabulary at the tool boundary.

Adaptive orchestration continues to use planner, builder, and verifier roles. Routing considers only models with fresh `ready` evidence and tool support. It adds deterministic role affinity:

- Fable-family models are preferred for high-context planning and ambitious autonomous builds.
- Opus-family models are preferred for implementation and independent verification.
- capability, context, readiness, and latency remain authoritative; family affinity only breaks otherwise viable choices.
- no unavailable model is selected and no provider is silently activated.

The catalog remains data-driven and already contains Claude Fable 5 and Claude Opus 5. The router matches model families rather than freezing a single version, allowing provider discovery to supply later compatible releases.

## Safe Auto Mode

The existing transcript classifier is enabled in Tovyr builds and exposed through `/auto`. Entry still runs the existing availability checks, opt-in policy, model capability test, and circuit breaker. Auto mode may approve routine edits and allowlisted commands, but destructive commands, unusual shell operations, secret paths, and cross-machine messages retain explicit permission checks. `/code`, `/plan`, `/safe`, and `/bypass` keep their current meanings.

## Activity UX

The current `TovyrActivitySurface` is the single live row. Thinking, streaming, tool execution, permission waits, orchestration handoffs, and verification reduce into that row. Completed tool calls stay as compact transcript evidence with inline diffs and results. No second spinner is introduced. Reduced-motion, `NO_COLOR`, narrow terminals, and Windows remain supported.

Cross-session sends and role handoffs use the existing compact tool/evidence presentation. The footer continues to display the active permission mode at bottom right.

## CPU and Garbage Collection

Tovyr cannot disable the JavaScript engine's automatic garbage collector. It can remove its own pathological forced-GC behavior. The one-second `Bun.gc` interval in headless execution is removed.

A small idle-GC scheduler replaces it for long-running interactive sessions:

- it samples infrequently and uses unref'ed timers;
- it never calls forced GC during an active turn or within the idle grace period;
- it requires meaningful heap pressure before collecting;
- it coalesces repeated pressure into at most one collection per cooldown;
- it is disabled when `Bun.gc` is unavailable.

The performance target is at least a 2× reduction in harness-owned periodic CPU wakeups during an active run. This is verified structurally and with scheduler tests; end-to-end CPU measurements are recorded by the benchmark harness and reported honestly rather than treated as a universal hardware guarantee.

## Failure Handling and Security

- malformed or oversized IPC frames are rejected without reaching model context;
- connection failures return a normal failed tool result;
- named-pipe/socket cleanup is registered with graceful shutdown;
- local IPC never transports provider keys, tokens, tool approvals, or structured control messages;
- received text is attributed as another session and never mistaken for a system instruction;
- auto mode does not bypass the existing safety checks;
- routing falls back to the active ready model when no independent verifier exists and shows a warning.

## Verification

Focused tests cover protocol validation, Windows/Unix address generation, queue delivery, peer discovery, `SendMessage` availability, auto-mode entry, Fable/Opus role affinity, single-row activity behavior, and idle-only forced GC. The release then runs focused Bun tests, TypeScript checking, Tovyr quality gates, and the CLI benchmark from the project working directory. Existing unrelated worktree changes are preserved.
