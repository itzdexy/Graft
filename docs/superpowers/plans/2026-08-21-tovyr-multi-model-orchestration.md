# Tovyr Multi-Model Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let complex Tovyr work plan with one ready model, build with another, and verify with a third while remaining deterministic, resumable, permission-safe, and visible in the chat UI.

**Architecture:** Extend the existing persisted `AgentSession` rather than creating a second agent framework. Add role assignments, evidence handoffs, and an explicit orchestration state machine; select same-provider ready models deterministically and inject the role model into the existing query options for each phase. The UI rail appears only for relevant active runs.

**Tech Stack:** TypeScript, Bun test, existing Tovyr agent/session persistence, query pipeline, Ink

**Spec:** `docs/superpowers/specs/2026-08-21-tovyr-chat-model-orchestration-design.md`

## Global Constraints

- Casual chat, explanations, and small changes remain single-model.
- Adaptive orchestration applies to complex multi-step implementation work and can be explicitly disabled.
- Planner is read-only; builder remains governed by existing permission modes; verifier requires raw evidence.
- Role routing selects only models ready for the required capabilities.
- The first implementation routes among ready models on the active provider and never silently changes providers.
- If fewer than three eligible models exist, roles may share a model and the UI must say so.
- Verification repair rounds are bounded; no infinite agent loops.
- Persisted runs survive restart without repeating completed write actions.
- Plan mode writes `tovyrplan.md`; `/code` accepts and implements it.

## File Structure

- Modify `services/tovyr/agent/types.ts`: orchestration roles, assignments, state, and evidence.
- Modify `services/tovyr/agent/persistence.ts`: versioned migration and structural guards.
- Create `services/tovyr/agent/roleRouter.ts`: deterministic ready-model selection.
- Create `services/tovyr/agent/roleRouter.test.ts`: capability and fallback routing tests.
- Create `services/tovyr/agent/orchestrationState.ts`: state transitions and bounded repair loop.
- Create `services/tovyr/agent/orchestrationState.test.ts`: transition tests.
- Modify `services/tovyr/agent/handoffs.ts`: structured evidence instead of prose-only assumptions.
- Modify `services/tovyr/agent/ExecutionEngine.ts`: role-specific context and evidence prompts.
- Modify `query.ts`: apply the active role’s same-provider model override.
- Create `components/tovyr/TovyrOrchestrationRail.tsx`: contextual PLAN/BUILD/VERIFY rail.
- Modify `TovyrChatDock` and existing coordinator status integration.

---

### Task 1: Versioned orchestration session types and persistence

**Files:**
- Modify: `services/tovyr/agent/types.ts`
- Modify: `services/tovyr/agent/persistence.ts`
- Modify: `services/tovyr/agent/persistence.test.ts`
- Modify: `services/tovyr/agent/GoalTracker.ts`

**Interfaces:**
- Produces: `OrchestrationRole`, `AgentRoleAssignment`, `AgentStepEvidence`, `AgentOrchestration`, and optional `AgentSession.orchestration`.

- [ ] **Step 1: Add failing round-trip and migration tests**

```ts
const orchestration = {
  enabled: true,
  state: 'drafting_plan',
  assignments: {
    planner: { role: 'planner', providerId: 'nvidia_nim', modelId: 'model-a', readinessCheckedAt: 1 },
    builder: { role: 'builder', providerId: 'nvidia_nim', modelId: 'model-b', readinessCheckedAt: 1 },
    verifier: { role: 'verifier', providerId: 'nvidia_nim', modelId: 'model-c', readinessCheckedAt: 1 },
  },
  evidence: [], repairRound: 0, maxRepairRounds: 3,
}
expect(loadAgentSession(cwd)?.orchestration).toEqual(orchestration)
```

Add a legacy-session fixture with no orchestration property and assert it still loads.

- [ ] **Step 2: Run persistence tests**

Run: `bun test services/tovyr/agent/persistence.test.ts`

Expected: FAIL because orchestration types and validation are absent.

- [ ] **Step 3: Add optional versioned state**

```ts
export type OrchestrationRole = 'planner' | 'builder' | 'verifier'
export type OrchestrationState =
  | 'drafting_plan' | 'awaiting_plan' | 'building' | 'verifying'
  | 'needs_input' | 'needs_changes' | 'model_failed' | 'blocked' | 'complete'

export type AgentStepEvidence = {
  stepId: string
  role: OrchestrationRole
  modelId: string
  summary: string
  filesChanged: string[]
  commands: Array<{ command: string; exitCode: number; summary: string }>
  failures: string[]
  createdAt: number
}
```

Use an optional field so old sessions remain valid. New orchestrated sessions set `schemaVersion: 2` inside `orchestration`.

- [ ] **Step 4: Run persistence and goal tests**

Run: `bun test services/tovyr/agent/persistence.test.ts services/tovyr/agent/GoalTracker.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit session schema support**

Commit task files with message `feat: persist orchestration state`.

### Task 2: Deterministic ready-model role router

**Files:**
- Create: `services/tovyr/agent/roleRouter.ts`
- Create: `services/tovyr/agent/roleRouter.test.ts`
- Modify: `services/tovyr/modelContext.ts`
- Consume: `services/tovyr/modelReadiness.ts`

**Interfaces:**
- Produces: `assignOrchestrationRoles(input: RoleRouterInput): RoleRouterResult`.
- Consumes: ready model records from the active provider only.

- [ ] **Step 1: Write failing routing tests**

Cover three eligible models, one eligible model shared across roles, chat-only exclusion for builder/verifier, slow exclusion, planner preference for reasoning/context, builder requirement for tools, verifier preference for an independent model, and explicit user role preference.

```ts
expect(assignOrchestrationRoles(input).assignments).toMatchObject({
  planner: { modelId: 'reasoning-large' },
  builder: { modelId: 'tool-coder' },
  verifier: { modelId: 'review-model' },
})
```

- [ ] **Step 2: Run the missing-router test**

Run: `bun test services/tovyr/agent/roleRouter.test.ts`

Expected: FAIL because the router does not exist.

- [ ] **Step 3: Implement deterministic scoring**

Reject any state other than `ready` for builder/verifier. Score planner by reasoning then context, builder by verified tools then context then latency, verifier by verified tools and model independence. Stable-sort by model ID as the final tie-breaker. Return warnings when roles share a model.

- [ ] **Step 4: Run router and readiness tests**

Run: `bun test services/tovyr/agent/roleRouter.test.ts services/tovyr/modelReadiness.test.ts services/tovyr/modelContext.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit deterministic routing**

Commit task files with message `feat: route orchestration roles`.

### Task 3: Explicit orchestration state machine and repair budget

**Files:**
- Create: `services/tovyr/agent/orchestrationState.ts`
- Create: `services/tovyr/agent/orchestrationState.test.ts`
- Modify: `services/tovyr/agent/AgentManager.ts`
- Modify: `services/tovyr/agent/autoBootstrap.ts`
- Modify: `services/tovyr/agent/autoBootstrap.test.ts`

**Interfaces:**
- Produces: `transitionOrchestration(session, event): AgentSession` and `shouldUseAdaptiveOrchestration(prompt): boolean`.

- [ ] **Step 1: Add failing transition and trigger tests**

Assert:

```ts
drafting_plan + plan_ready -> awaiting_plan
awaiting_plan + plan_accepted -> building
building + step_complete -> building or verifying
verifying + approved -> complete
verifying + needs_changes -> building with repairRound + 1
verifying + needs_changes at maxRepairRounds -> blocked
```

Assert `hello`, explanations, and a one-line rename stay single-model, while multi-file build/fix goals use orchestration unless `TOVYR_ORCHESTRATION=0`.

- [ ] **Step 2: Run state and bootstrap tests**

Run: `bun test services/tovyr/agent/orchestrationState.test.ts services/tovyr/agent/autoBootstrap.test.ts`

Expected: FAIL because orchestration transitions are implicit.

- [ ] **Step 3: Implement immutable validated transitions**

Unknown transitions throw in tests and return the unchanged session with a diagnostic in production. Save after every valid transition. `ensureAgentSessionForPrompt` creates role assignments only when adaptive orchestration is selected; otherwise existing single-model agent behavior remains unchanged.

- [ ] **Step 4: Run agent state tests**

Run: `bun test services/tovyr/agent/AgentManager.test.ts services/tovyr/agent/autoBootstrap.test.ts services/tovyr/agent/orchestrationState.test.ts services/tovyr/agent/loopGuard.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the state machine**

Commit task files with message `feat: govern orchestrated runs`.

### Task 4: Structured planner, builder, and verifier handoffs

**Files:**
- Modify: `services/tovyr/agent/handoffs.ts`
- Modify: `services/tovyr/agent/ExecutionEngine.ts`
- Modify: `services/tovyr/agent/ExecutionEngine.test.ts`
- Modify: `services/tovyr/agent/coordinator.ts`
- Modify: `services/tovyr/agent/coordinator.test.ts`
- Modify: `services/tovyr/verify/verifyPrompts.ts`

**Interfaces:**
- Consumes: role assignment and `AgentStepEvidence`.
- Produces: role-specific prompts that pass evidence, not unverified claims.

- [ ] **Step 1: Add failing prompt-contract tests**

Planner prompt must include goal/constraints/acceptance criteria and forbid edits. Builder prompt must include one approved step and permission rules. Verifier prompt must include changed files, exact commands, exit codes, failures, and the sentence `Do not trust the builder's conclusion; evaluate the evidence.`

- [ ] **Step 2: Run execution/coordinator tests**

Run: `bun test services/tovyr/agent/ExecutionEngine.test.ts services/tovyr/agent/coordinator.test.ts`

Expected: FAIL because handoffs summarize completed titles but do not carry structured evidence.

- [ ] **Step 3: Build role-specific prompt sections**

Add `buildOrchestrationHandoff(session, role)` that serializes only the fields relevant to the next role, redacts secrets using existing tool-log safety helpers, and caps evidence length. Planner receives no write-tool encouragement; verifier receives no claim of success beyond raw results.

- [ ] **Step 4: Run prompt, safety, and verification tests**

Run: `bun test services/tovyr/agent/ExecutionEngine.test.ts services/tovyr/agent/coordinator.test.ts services/tovyr/tools/safety.test.ts services/tovyr/verify`

Expected: PASS.

- [ ] **Step 5: Commit structured handoffs**

Commit task files with message `feat: hand off orchestration evidence`.

### Task 5: Apply role model overrides through the existing query pipeline

**Files:**
- Create: `services/tovyr/agent/activeRoleModel.ts`
- Create: `services/tovyr/agent/activeRoleModel.test.ts`
- Modify: `query.ts`
- Modify: `services/tovyr/agent/ExecutionEngine.ts`
- Modify: `services/tovyr/providerFailover.ts`

**Interfaces:**
- Produces: `getActiveRoleModel(session): { providerId: string; modelId: string; role: OrchestrationRole } | null`.
- Consumes: current active provider ID and role assignments.

- [ ] **Step 1: Add failing role-model tests**

Assert planner/build/verifier states return the correct assignment; non-orchestrated sessions return null; assignments on a provider other than the active provider are rejected with an actionable diagnostic rather than silently switching providers.

- [ ] **Step 2: Run active-role tests**

Run: `bun test services/tovyr/agent/activeRoleModel.test.ts`

Expected: FAIL because phase requests always use the current main-loop model.

- [ ] **Step 3: Inject the same-provider model into query options**

Immediately before the main model request, resolve the active session and use:

```ts
const roleModel = getActiveRoleModel(session)
const requestModel = roleModel?.modelId ?? options.model
```

Do not persist it as the user’s global model. On model failure, transition to `model_failed` and ask the role router for another ready same-provider model; never replay a completed builder write step.

- [ ] **Step 4: Run query contracts and agent tests**

Run: `bun test services/tovyr/agent services/tovyr/providerFailover.test.ts services/tovyr/launcherStartupContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit query routing**

Commit task files with message `feat: execute agent roles with assigned models`.

### Task 6: Contextual PLAN/BUILD/VERIFY rail

**Files:**
- Create: `components/tovyr/TovyrOrchestrationRail.tsx`
- Create: `components/tovyr/TovyrOrchestrationRail.test.ts`
- Modify: `components/tovyr/TovyrChatDock.tsx`
- Modify: `components/CoordinatorAgentStatus.tsx`
- Modify: `services/tovyr/agent/autoBootstrap.ts`
- Consume: canonical model display names and activity surface from plans 1 and 3.

**Interfaces:**
- Consumes: active relevant `AgentSession.orchestration`.
- Produces: `projectOrchestrationRail(session, width): RailSegment[]` and a keyboard-focusable Ink rail.

- [ ] **Step 1: Add failing rail projection tests**

Assert three segments at wide widths, only the active segment plus `1/3` at narrow widths, full model labels via the canonical formatter, shared-model disclosure, and no rail for casual chat or non-orchestrated sessions.

- [ ] **Step 2: Run rail tests**

Run: `bun test components/tovyr/TovyrOrchestrationRail.test.ts services/tovyr/agent/autoBootstrap.test.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement contextual rail and controls**

Use textual states `waiting`, `working`, `complete`, `needs changes`, and `failed`. Keyboard focus exposes inspect evidence, pause/resume, redirect, and choose replacement model. The rail collapses to one transcript evidence line after completion.

- [ ] **Step 4: Run UI, layout, and agent tests**

Run: `bun test components/tovyr/TovyrOrchestrationRail.test.ts services/tovyr/terminalLayout.test.ts services/tovyr/agent`

Expected: PASS.

- [ ] **Step 5: Commit orchestration UI**

Commit task files with message `feat: show multi-model run rail`.

### Task 7: End-to-end resume, failure, and permission verification

**Files:**
- Create: `services/tovyr/agent/orchestration.integration.test.ts`
- Modify: `docs/GUIDE.md`
- Modify: `docs/tovyr-agent-roadmap.md`

**Interfaces:**
- Consumes: all orchestration interfaces from Tasks 1–6.
- Produces: a release-level integration contract.

- [ ] **Step 1: Write the end-to-end test before final integration fixes**

Use fake model adapters and a temporary project to cover: planner plan output, builder evidence, verifier rejection, bounded repair, verifier approval, process reload, no replay of completed write evidence, same-model fallback disclosure, provider mismatch refusal, and permission denial propagation.

- [ ] **Step 2: Run the integration test and record failures**

Run: `bun test services/tovyr/agent/orchestration.integration.test.ts`

Expected: FAIL on any integration seam not wired by prior tasks.

- [ ] **Step 3: Apply only the minimal integration corrections**

Fix the exact seams reported by the test. Do not add cross-provider automatic switching or a new agent framework.

- [ ] **Step 4: Run release verification**

Run:

```powershell
bun test services/tovyr
npm run check:brand
bun run entrypoints/cli.tsx --help
git diff --check
```

Expected: all tests and brand check PASS; source CLI help exits successfully; no whitespace errors.

- [ ] **Step 5: Commit integration and docs**

Commit task files with message `feat: complete multi-model orchestration`.

