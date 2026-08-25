# Tovyr Workbench Product and Architecture Design

**Date:** 2026-08-24  
**Status:** Approved direction, implementation contract pending written-spec review  
**Product:** Tovyr source CLI (`bun run entrypoints/cli.tsx`)

## Goal

Turn Tovyr into a dependable, polished, keyboard-first coding agent for daily
developer work. The product should combine the strongest workflow principles of
modern terminal agents without copying another product's visual identity:

- a dense, responsive workbench and flexible provider/agent model;
- transparent planning, editing, tool execution, diagnostics, and verification;
- persistent sessions, searchable memory, reusable skills, and learned workflows;
- safe permissions with enough automation to complete real coding tasks;
- a Windows-first source runtime that remains useful in narrow and limited-color
  terminals.

The default experience remains conversational. Workspace chrome appears only
when it improves the current task.

## Product Thesis

- **Archetype:** terminal-native AI coding workbench.
- **Primary user:** a developer working inside an existing repository.
- **Primary task:** describe an outcome, observe and steer execution, then review
  evidence that the code works.
- **Density:** high information density with progressive disclosure.
- **Tone:** calm, exact, technical, and candid.
- **Platform context:** Bun, React, Ink, PowerShell/Windows first, portable to
  conventional terminals.
- **Distinctive principle:** the interface expands around evidence, then becomes
  quiet again.
- **Must never feel like:** a decorative chatbot, a fake progress animation, or a
  wall of raw logs.

## Current Evidence

The design responds to the repository state observed on 2026-08-24:

- The source CLI help path launches successfully.
- A focused source-runtime detection test fails because the current package name
  is `tovyr` while detection still expects the previous package identity.
- The broad TypeScript project reports 1,814 diagnostic lines, dominated by
  unavailable generated/upstream modules, compile-time macros, and stale paths.
- Twelve Tovyr UI components are explicitly baselined as unreferenced.
- The worktree contains a substantial unfinished UI/runtime improvement pass;
  those changes are treated as project work to preserve and complete.
- Existing strengths include a command palette, model selector, context meter,
  activity model, search list, prompt mode badge, responsive key hints, and
  provider abstraction.

## Product Principles

1. **Show the work truthfully.** Render real runtime state, exact commands,
   changed paths, diagnostics, and test results. Never invent stages, percentages,
   sources, confidence, or progress.
2. **Chat first, workbench when useful.** Normal questions stay single-column.
   Plans, diffs, long-running tools, and multi-agent work can open focused detail
   surfaces.
3. **One owner per state.** A turn has one activity model and one live renderer.
   Provider state, permissions, sessions, and layout each have one source of truth.
4. **Keyboard complete.** Every primary action is reachable without a mouse and
   exposes its real shortcut through searchable help.
5. **Automation with boundaries.** Common coding operations can proceed in Code
   mode; destructive, unusual, external, and secret-bearing actions remain
   explicit.
6. **Evidence before completion.** The agent does not claim success without fresh
   verification appropriate to the change.
7. **Recover instead of strand.** Timeouts, provider failures, permission denial,
   invalid models, interrupted tools, and malformed output lead to a visible next
   action.
8. **Local-first privacy.** Sessions, memory, plans, and checkpoints stay local by
   default. Network use and sharing remain explicit.

## User Experience Architecture

### 1. Adaptive Workbench Shell

The UI has four conceptual regions, not four permanently visible boxes:

1. **Context rail:** project, branch, dirty state, active session, provider/model,
   and connection health.
2. **Transcript:** user turns, assistant responses, compact completed evidence,
   and expandable errors/tool results.
3. **Focus surface:** a temporary plan, diff, approval, file, diagnostics, agent,
   or tool-output view.
4. **Composer rail:** multiline input, suggestions, mode, context usage, and key
   hints.

Responsive behavior:

- Below 60 columns: transcript and composer only; all metadata becomes compact
  text and overlays use the full available width.
- From 60 to 119 columns: transcript with focused overlays; no persistent side
  panel.
- At 120 columns and wider: an optional side panel can show the current plan,
  diff, file tree, agents, or tool output.
- Short terminals prioritize composer, pending approval, and active work. Optional
  headers and history yield first.
- Resizing never loses input, selection, scroll position, or an approval action.

### 2. Visual Direction

The aesthetic is **Technical Precision / Monochrome Command**:

- near-monochrome canvas and surfaces;
- one Tovyr interaction accent plus semantic success, warning, and danger roles;
- flat structure with borders and alignment instead of decorative cards/shadows;
- terminal typography supplied by the user's terminal, with weight and color—not
  many pseudo-font sizes—creating hierarchy;
- machine-readable values use tabular/monospaced alignment;
- minimal geometry and restrained symbols;
- motion only for live state, never for decoration;
- the recurring motif is a slim evidence rail that connects active work to its
  completed result.

All components use semantic theme tokens. Raw product gradients, arbitrary color
hexes, robot/sparkle iconography, and unrelated glass/card treatments are removed.

### 3. Default Chat Flow

1. Startup identifies the project and validates the active provider/model without
   blocking on optional services.
2. The welcome view shows project facts, the most useful next actions, and recent
   sessions only when relevant.
3. User input accepts natural language, slash commands, file mentions, pasted
   text/images, multiline editing, and history.
4. The transcript shows one live activity surface while the current turn works.
5. Concrete tool/search/diagnostic events replace generic thinking copy.
6. Assistant streaming text suppresses redundant idle animation.
7. Completion collapses activity into one evidence summary with an expansion
   affordance.
8. The prompt remains available for interrupt-and-steer when safe.

### 4. Modes

The active mode is always visible in the prompt footer bottom-right.

- **Ask:** conversational help; reads/searches may run, mutations ask.
- **Plan:** read-only exploration and planning; writes only `tovyrplan.md` and
  explicitly approved planning artifacts.
- **Code:** implements approved plans or direct build requests. It auto-accepts
  Write/Edit and allowlisted developer commands such as `git`, `gh`, `npm`, Bun,
  test runners, formatters, and compilers.
- **Bypass:** broad automation for a trusted workspace, but destructive commands,
  secret paths, external directories, and credential-bearing operations still ask.
- **Superthink:** structured clarification workflow whose current state is visible
  and resumable.

Natural-language construction requests promote from Ask to Code. `/plan` drafts
`tovyrplan.md`; `/code` accepts and implements it. `/init` creates `tovyr.md`.

### 5. Command and Discovery Model

- Bare `tovyr` launches the interactive agent.
- Help is available only with `tovyr --help` outside the UI.
- `--help`, `/help`, `?`, and Ctrl+P share one command/shortcut registry.
- Ctrl+P opens searchable commands grouped by coding, context, models, sessions,
  tools, skills, configuration, and diagnostics.
- `/model` lists only verified models for the active connected provider.
- `/provider` switches provider and exposes connection/readiness state.
- Commands exist for session resume/fork/search, checkpoints/undo, diff review,
  diagnostics, memory, skills, tools, and workspace panels.
- Help never advertises an unimplemented shortcut or command.

### 6. Activity, Tools, and Evidence

`TovyrTurnActivity` is the sole active-turn view model. Runtime events reduce into
one priority state:

`permission > failure/recovery > concrete tool > search/read > handoff/verify > thinking`

The live UI contains at most one headline and a small bounded evidence list.
Finished history is static. Tool presentation follows these rules:

- Reads/searches with the same purpose collapse into a group.
- File edits show path and change summary, with diff expansion.
- Shell commands show the exact command, working directory when material, elapsed
  time, exit state, and a bounded tail while running.
- Background tools expose process identity and poll/stop/open-output actions.
- Errors show a plain-language summary, affected operation, likely cause, and a
  recovery action; raw detail is expandable.
- Large output is paged or summarized without making the approval/composer
  unreachable.

### 7. Permission Experience

Permission decisions are resource-based and ordered. Each request presents:

- action and originating agent/tool;
- exact command, path, URL, query, or target agent;
- working directory and external-workspace boundary when relevant;
- risk explanation in plain language;
- choices for once, session, workspace, deny, and deny-with-feedback where valid;
- a safe alternative when one exists.

The action row stays visible when command/output content is long. Keyboard focus is
predictable. Nested agent permission requests route to the parent UI instead of
hanging invisibly. Child agents inherit the parent's restrictive ceiling; a child
may be stricter but never more permissive without a new visible approval.

### 8. Coding Execution Loop

All build work follows a durable run state:

1. **Understand:** read project instructions, git state, target files, tests, and
   relevant configuration.
2. **Plan:** create an internal task graph or use `tovyrplan.md` for explicit Plan
   mode.
3. **Checkpoint:** capture the pre-edit state and intended mutation set.
4. **Edit:** apply bounded changes with paths and diffs recorded.
5. **Diagnose:** consume compiler, LSP, lint, test, and runtime feedback.
6. **Repair:** reproduce failures, add regression tests, and retry within explicit
   budgets.
7. **Verify:** run fresh commands that prove each completion claim.
8. **Review:** show final changed files, verification evidence, unresolved risks,
   and undo/checkpoint options.

The run survives recoverable provider errors, interruptions, and process restarts.
Loop detection prevents repeating an identical failing action without new evidence.

### 9. Sessions, Memory, Skills, and Agents

Sessions are project-scoped by default and support list, search, resume, continue,
fork, rename, archive, and recovery after interruption. A session stores:

- user/assistant transcript;
- selected provider/model and mode;
- run/task state;
- tool evidence and approvals;
- checkpoints and changed-path summaries;
- compacted context provenance.

Memory has explicit layers:

- `tovyr.md` project instructions;
- user preferences and environment facts;
- session summaries and searchable prior work;
- learned reusable procedures saved as skills only with visible provenance.

Memory is editable, inspectable, deletable, and never silently treated as higher
authority than current project instructions. Skills have metadata, scope,
permissions, source, and last-used/last-updated information.

Primary agents include Ask, Plan, Build, and Review. Focused child roles include
Explore, Test, Debug, Research, and Review. Child work uses isolated context,
bounded turn budgets, visible parentage, and summarized evidence. Parallel work is
used only for independent tasks.

### 10. Provider and Model Reliability

Provider state separates:

- credential presence;
- catalog availability;
- endpoint reachability;
- model compatibility;
- last successful request;
- transient rate/timeout health.

Model activation is transactional: validate the requested provider/model, persist
only after success, update UI state atomically, and retain the previous working
selection on failure. OpenAI-compatible providers show verified live API models.
FreeModel uses API-key authentication via `tovyr auth login --key`; the legacy web
OAuth path is not presented. Automatic provider failover remains opt-in through
`TOVYR_AUTO_FAILOVER=1` and is disclosed when it occurs.

### 11. Execution Backends

The initial release keeps local execution as the complete, supported path while
defining a stable backend contract for future container and SSH execution. The
contract owns:

- working directory and filesystem boundary;
- environment-variable allowlist;
- process start, streaming, input, poll, wait, and termination;
- timeout and output limits;
- credential exposure policy;
- persistent versus disposable workspace semantics.

The UI never describes an in-process allowlist as a security sandbox. Strong
isolation requires an operating-system boundary.

## Internal Architecture

### Runtime Layers

1. **CLI bootstrap:** argument parsing, project-root resolution, environment, early
   input, startup diagnostics, and source-runtime detection.
2. **Agent runtime:** request assembly, provider routing, tool loop, mode policy,
   recovery, and completion verification.
3. **Domain services:** projects, sessions, checkpoints, permissions, providers,
   models, memory, skills, diagnostics, and execution backends.
4. **Event/view-model layer:** typed runtime events reduced into stable UI models.
5. **Ink presentation:** adaptive shell, transcript, focus surfaces, composer,
   overlays, and theme tokens.

React components do not infer domain state from assistant prose. Domain services do
not emit terminal formatting. Legacy UI components either become thin adapters to
the new models or are removed after their call sites migrate.

### Persistent State

Project-owned state lives under `.tovyr/` except user-visible `tovyr.md` and
`tovyrplan.md`. User-global configuration and credentials live under `~/.tovyr/`.
Writes use versioned schemas, atomic replacement, and recovery from partial files.
Secrets are never written into transcripts, plans, checkpoints, test fixtures,
logs, git commits, or npm artifacts.

### Error Model

Errors have a stable machine code, user summary, technical detail, operation,
recoverability, suggested actions, and causal chain. UI rendering maps those fields
to compact and expanded states. Provider, permission, process, filesystem, parse,
and validation failures remain distinguishable.

## Accessibility and Terminal Resilience

- Every state has a text label; color is never the sole signal.
- Limited-color, `NO_COLOR`, `TERM=dumb`, CI, and reduced-motion paths are static
  and complete.
- All overlays, lists, permissions, and expansions are keyboard operable.
- Focus is visible and restored after closing overlays.
- Unicode symbols have ASCII fallbacks where terminal capability is limited.
- Width calculations use display width rather than JavaScript string length.
- Long paths, commands, model names, translated text, and tool output cannot push
  primary actions off-screen.
- Interrupt, exit, and destructive confirmations are unambiguous.

## Implementation Program

The work is delivered through sequential release gates so the CLI remains usable
throughout the overhaul:

1. **Foundation gate:** baseline tests, source-runtime fix, meaningful typecheck
   boundary, event contracts, semantic tokens, and deterministic terminal harness.
2. **Shell gate:** adaptive workbench, header/context rail, transcript, focus
   surface, composer/footer, command registry, help, and responsive behavior.
3. **Execution gate:** one activity surface, tool/evidence rendering, approvals,
   errors, background processes, diffs, diagnostics, checkpoints, and undo.
4. **Agent gate:** coding loop, plans, verification, resumable run state, loop
   detection, named agents, and safe child-agent permission inheritance.
5. **Knowledge gate:** session search/resume/fork, memory inspection, skill capture,
   provenance, and compaction visibility.
6. **Provider gate:** readiness state, transactional model selection, source-only
   authentication flow, timeout recovery, and opt-in failover disclosure.
7. **Quality gate:** dead-UI elimination, narrow/short/limited-color audits,
   disposable-project human trials, documentation, packaging dry run, and final
   defect report.

Each gate begins with failing behavioral tests for new behavior and ends with fresh
focused and regression verification.

## Testing Strategy

### Unit and Contract Tests

- reducers for activity, run state, permissions, provider readiness, checkpoints,
  and session recovery;
- layout projections at representative widths/heights;
- command/help registry parity;
- display-width truncation and long-content behavior;
- mode permission matrices and child-agent restrictive ceilings;
- provider/model activation rollback;
- error-to-recovery mappings;
- memory/skill schema migration and provenance.

### Component Tests

- empty, loading, active, success, failure, interrupted, and overflow states;
- keyboard navigation, focus restoration, selection, and escape behavior;
- static/reduced-motion and colorless output;
- transcript evidence collapse and expansion;
- approval actions remaining visible with pathological input.

### Integration Tests

- source CLI help/version/doctor/auth/provider/model/config behavior;
- mocked provider stream with reads, edits, shell, tests, permission denial,
  interruption, retry, and completion;
- plan-to-code handoff and natural-language Code promotion;
- session persist/resume after forced termination;
- checkpoint creation and undo;
- child-agent permission propagation;
- startup and model failure recovery.

### Human-Use Trials

Run the source CLI—not `tovyr.exe`—from disposable repositories and perform:

1. initialize a small application and create `tovyr.md`;
2. ask a codebase question without mutations;
3. draft `tovyrplan.md`, approve it with `/code`, and implement it;
4. request a natural-language build and confirm Code-mode promotion;
5. introduce a failing test, diagnose it, repair it, and verify it;
6. inspect and reject a permission request, then take the safe alternative;
7. run a long/background command, inspect output, interrupt it, and recover;
8. switch provider/model and recover from an invalid selection;
9. interrupt, exit, resume, search, and fork the session;
10. review diff/evidence, undo a checkpoint, and reapply the change;
11. repeat representative flows at narrow/short sizes and with `NO_COLOR=1`.

Network-backed model trials run only with already configured credentials and never
print, copy, or persist those credentials.

## Success Criteria

- Bare `tovyr` launches the interactive source agent; `tovyr --help` owns help.
- The primary coding journey works end to end without entering an unwired/dead UI.
- Exactly one live activity surface renders per turn.
- Active Tovyr mode is always present bottom-right.
- Every advertised shortcut and command is implemented and searchable.
- Plan mode is read-only except for planning artifacts; Code mode handles ordinary
  developer edits/commands without repetitive prompts while preserving safety
  boundaries.
- Users can inspect exact mutations, command output, tests, diagnostics, approvals,
  provider health, session state, memory provenance, and child-agent work.
- Interrupted work can resume without losing the plan or evidence.
- New behavior has observed red-green tests and fresh final verification.
- The source-runtime test passes and Tovyr-owned TypeScript code has a meaningful,
  reproducible diagnostic gate.
- Unreferenced Tovyr components are either integrated or deleted; no new dead UI is
  accepted.
- Human-use trials produce a candid defect report rather than an unsupported
  polish claim.

## Non-Goals

- Copying OpenCode, Hermes Agent, Claude Code, or any other product's brand or UI
  one-for-one.
- Launching or depending on `tovyr.exe`.
- Replacing Bun/Ink with a desktop/web rewrite during this program.
- Shipping every proposed remote execution backend before the local backend is
  complete and testable.
- Enabling provider failover by default.
- Hiding unresolved upstream/generated-code limitations merely to make a global
  typecheck command appear green.
- Publishing to npm, pushing to GitHub, or changing external services without a
  separate explicit request.

## Reference Principles

- OpenCode agent and permission concepts:
  <https://opencode.ai/docs/agents/>
- OpenCode product capabilities:
  <https://opencode.ai/>
- Hermes Agent toolsets and execution backends:
  <https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/tools.md>
- Hermes Agent persistent memory, skills, and cross-surface approach:
  <https://github.com/NousResearch/hermes-agent>
- Claude Code CLI workflow surface:
  <https://docs.anthropic.com/en/docs/claude-code/cli-usage>

These references inform workflow principles only. Tovyr retains its own identity,
source architecture, terminology, and design system.
