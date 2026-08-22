# Tovyr Model Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate provider reachability from model readiness and make every model activation transactional across all Tovyr selection surfaces.

**Architecture:** Replace the boolean unavailable quarantine with structured readiness evidence, expose a provider/model probe that does not mutate active state, and centralize activation in one preflight-then-commit service. Pickers render `listed`, `ready`, `chat only`, `slow`, `unavailable`, and `unsuitable` honestly.

**Tech Stack:** TypeScript, Bun test, Fetch API, Ink, existing provider/OpenAI-compat services

**Spec:** `docs/superpowers/specs/2026-08-21-tovyr-chat-model-orchestration-design.md`

## Global Constraints

- A model inventory response proves only `listed`, never `ready`.
- A reachable provider with a timed-out model renders `provider: reachable`, `model: slow`.
- A failed candidate must leave persisted provider state, environment, proxy, session model, and app state unchanged.
- Unknown tool support is not treated as supported.
- Hard model failures may be quarantined; timeouts and transient network failures are not hard quarantines.
- Automatic recovery remains on the selected provider unless cross-provider failover is explicitly enabled.
- All commands run from the project directory with Bun/source Tovyr.

## File Structure

- Create `services/tovyr/modelReadiness.ts`: structured readiness store and expiry policy.
- Create `services/tovyr/modelReadiness.test.ts`: state and cache policy tests.
- Modify `services/tovyr/providers/types.ts`: separate provider connection and model readiness types.
- Modify `services/tovyr/providers/probe.ts`: non-mutating provider/model probes and honest snapshots.
- Modify `services/tovyr/providers/probe.test.ts`: timeout/readiness regression tests.
- Modify `scripts/tovyr-providers.js`: resolve an arbitrary configured provider/model without changing active state.
- Create `services/tovyr/activateProviderModel.ts`: transactional activation service.
- Create `services/tovyr/activateProviderModel.test.ts`: mutation-order and rollback tests.
- Modify all model/provider picker and command entry points to consume the activation service.
- Modify model catalog resolution and failover to consume structured readiness.

---

### Task 1: Structured model readiness records

**Files:**
- Create: `services/tovyr/modelReadiness.ts`
- Create: `services/tovyr/modelReadiness.test.ts`
- Modify: `services/tovyr/modelAvailability.ts` to a compatibility wrapper during migration.

**Interfaces:**
- Produces: `ModelReadinessState`, `ModelReadinessRecord`, `setModelReadiness`, `getModelReadiness`, `clearModelReadiness`, and `resetModelReadiness`.

- [ ] **Step 1: Write failing readiness-store tests**

```ts
import { afterEach, describe, expect, test } from 'bun:test'
import { getModelReadiness, resetModelReadiness, setModelReadiness } from './modelReadiness.js'

describe('model readiness', () => {
  afterEach(resetModelReadiness)

  test('keeps provider reachability separate from slow model inference', () => {
    setModelReadiness({
      providerId: 'nvidia_nim', modelId: 'meta/llama', state: 'slow',
      source: 'probe', checkedAt: 100, latencyMs: 8_001,
      detail: 'Probe exceeded 8s', hardFailure: false,
    }, 100)
    expect(getModelReadiness('nvidia_nim', 'meta/llama', 150)?.state).toBe('slow')
  })

  test('expires transient evidence without treating it as unavailable', () => {
    setModelReadiness({
      providerId: 'p', modelId: 'm', state: 'slow', source: 'probe',
      checkedAt: 0, hardFailure: false,
    }, 10)
    expect(getModelReadiness('p', 'm', 11)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the missing-module test**

Run: `bun test services/tovyr/modelReadiness.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the readiness types and keyed store**

```ts
export type ModelReadinessState =
  | 'unknown' | 'listed' | 'probing' | 'ready' | 'chat_only'
  | 'slow' | 'unavailable' | 'unsuitable'

export type ModelReadinessRecord = {
  providerId: string
  modelId: string
  state: ModelReadinessState
  source: 'catalog' | 'provider' | 'registry' | 'probe'
  checkedAt: number
  latencyMs?: number
  supportsTools?: boolean
  supportsStreaming?: boolean
  detail?: string
  hardFailure: boolean
}
```

Use `${providerId}\0${modelId}` as the key. The legacy availability exports delegate to `unavailable` records only until all consumers migrate.

- [ ] **Step 4: Run readiness and compatibility tests**

Run: `bun test services/tovyr/modelReadiness.test.ts services/tovyr/modelAvailability.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the structured store**

Commit only the three task files with message `feat: track model readiness evidence`.

### Task 2: Honest, non-mutating provider/model probes

**Files:**
- Modify: `scripts/tovyr-providers.js`
- Modify: `services/tovyr/providers/types.ts`
- Modify: `services/tovyr/providers/probe.ts`
- Modify: `services/tovyr/providers/probe.test.ts`
- Modify: `services/tovyr/providerModels.ts`

**Interfaces:**
- Produces: `resolveProviderSelection(providerId, modelId, state?)` in the JS provider module.
- Produces: `probeProviderModel(input: { providerId: string; modelId: string; requireTools?: boolean; timeoutMs?: number }): Promise<ModelProbeResult>`.
- Produces: provider snapshot state `reachable` independently of model readiness.

- [ ] **Step 1: Add failing probe classification tests**

```ts
expect(classifyProbeOutcome({ providerReachable: true, timedOut: true })).toEqual({
  providerState: 'reachable',
  modelState: 'slow',
  hardFailure: false,
})

expect(classifyProbeOutcome({ providerReachable: true, status: 404 })).toEqual({
  providerState: 'reachable',
  modelState: 'unavailable',
  hardFailure: true,
})
```

Add a test proving `resolveProviderSelection('nvidia_nim', 'candidate')` does not alter `loadState().active` or `loadState().models`.

- [ ] **Step 2: Run focused tests and reproduce the old lie**

Run: `bun test services/tovyr/providers/probe.test.ts services/tovyr/providerModels.test.ts`

Expected: FAIL because timeout classification exposes only the provider snapshot and can report ready.

- [ ] **Step 3: Split transport evidence from presentation**

Define:

```ts
export type ModelProbeResult = {
  providerId: string
  modelId: string
  providerState: 'reachable' | 'invalid_credentials' | 'limited' | 'offline'
  modelState: ModelReadinessState
  latencyMs: number
  supportsTools?: boolean
  supportsStreaming?: boolean
  detail?: string
  hardFailure: boolean
}
```

Use the arbitrary selection resolver to build credentials and URLs without `setActiveProvider` or `setActiveModel`. Store inventory results as `listed`; store successful inference as `ready` or `chat_only`; store timeout as `slow`.

- [ ] **Step 4: Run probe and provider tests**

Run: `bun test services/tovyr/providers/probe.test.ts services/tovyr/providerModels.test.ts services/tovyr/providerErrors.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the probe split**

Commit only task files with message `fix: separate provider and model health`.

### Task 3: Harmless tool-schema capability probe

**Files:**
- Modify: `services/tovyr/providers/probe.ts`
- Modify: `services/tovyr/providers/probe.test.ts`
- Modify: `services/tovyr/modelCapabilities.ts`
- Modify: `services/tovyr/modelCapabilities.test.ts`

**Interfaces:**
- Consumes: `probeProviderModel(..., requireTools: true)`.
- Produces: verified `supportsTools` evidence without executing a tool.

- [ ] **Step 1: Add failing tool-probe response tests**

Use fixture payloads for a valid `tool_calls` response, plain text despite forced tool choice, provider rejection of tools, and malformed tool arguments. Assert only the valid structured call yields `supportsTools: true`.

- [ ] **Step 2: Run the focused tests**

Run: `bun test services/tovyr/providers/probe.test.ts services/tovyr/modelCapabilities.test.ts`

Expected: FAIL because current probes only request the text `OK`.

- [ ] **Step 3: Add a synthetic non-executing tool schema**

Send a function named `tovyr_readiness_check` with schema:

```json
{"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"]}
```

The probe validates that the response contains a structured call with `{ "ok": true }`. It never routes the call into the Tovyr tool executor. If the provider rejects tool parameters, record `chat_only` rather than failing basic chat readiness.

- [ ] **Step 4: Run capability and conversion suites**

Run: `bun test services/tovyr/providers/probe.test.ts services/tovyr/modelCapabilities.test.ts services/tovyr/openaiCompat`

Expected: PASS.

- [ ] **Step 5: Commit verified tool capability support**

Commit task files with message `feat: verify model tool capability safely`.

### Task 4: Transactional model activation service

**Files:**
- Create: `services/tovyr/activateProviderModel.ts`
- Create: `services/tovyr/activateProviderModel.test.ts`
- Modify: `services/tovyr/applyActiveProvider.ts`

**Interfaces:**
- Consumes: `validateModelForProvider`, `probeProviderModel`, `setActiveProvider`, `setActiveModel`, and `applyActiveProviderSession`.
- Produces: `activateProviderModel(input: ActivateProviderModelInput): Promise<ActivateProviderModelResult>`.

- [ ] **Step 1: Write mutation-order tests with injected dependencies**

```ts
expect(await activateProviderModel(candidate, {
  validate: async () => ({ ok: true, model: candidate.modelId, corrected: false }),
  probe: async () => ({ ...slowProbe }),
  commit: () => { throw new Error('commit must not run') },
})).toMatchObject({ ok: false, readiness: 'slow' })
```

Add success assertions proving `commit` occurs only after validation and probe, and only once.

- [ ] **Step 2: Run the missing-service test**

Run: `bun test services/tovyr/activateProviderModel.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement preflight-then-commit**

```ts
export type ActivateProviderModelInput = {
  providerId: string
  modelId: string
  requireTools?: boolean
  allowSlow?: boolean
  setAppState?: (f: (prev: AppState) => AppState) => void
}

export type ActivateProviderModelResult =
  | { ok: true; providerId: string; modelId: string; readiness: 'ready' | 'chat_only' }
  | { ok: false; providerId: string; modelId: string; readiness: ModelReadinessState; message: string }
```

No persistent or process mutation occurs before the candidate passes. `allowSlow` requires explicit UI confirmation and never applies to automatic fallback.

- [ ] **Step 4: Run activation and provider-state tests**

Run: `bun test services/tovyr/activateProviderModel.test.ts services/tovyr/syncModelState.test.ts services/tovyr/applyProviderEnv.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the activation transaction**

Commit task files with message `feat: activate models transactionally`.

### Task 5: Migrate every selection and failover entry point

**Files:**
- Modify: `components/PromptInput/PromptInputFooter.tsx`
- Modify: `components/tovyr/TovyrProviderModelPicker.tsx`
- Modify: `commands/model/model.tsx`
- Modify: `commands/tovyr/models.tsx`
- Modify: `commands/tovyr/provider.tsx`
- Modify: `services/tovyr/providerFailover.ts`
- Test: `services/tovyr/providerFailover.test.ts`
- Test: `services/tovyr/providerModelPick.test.ts`

**Interfaces:**
- Consumes: `activateProviderModel` from Task 4 and readiness records from Task 1.
- Produces: identical activation behavior across footer, slash command, provider picker, and recovery.

- [ ] **Step 1: Add failing call-site contract tests**

Extract call-site handlers where needed and assert they do not call `setActiveProvider`, `setActiveModel`, or `applyActiveProviderSession` directly. Assert automatic fallback excludes `slow`, `chat_only` for tool-required work, `unavailable`, and `unsuitable` records.

- [ ] **Step 2: Run call-site and failover tests**

Run: `bun test services/tovyr/providerFailover.test.ts services/tovyr/providerModelPick.test.ts services/tovyr/activateProviderModel.test.ts`

Expected: FAIL while direct mutation paths remain.

- [ ] **Step 3: Replace direct mutation with the activation service**

Each handler renders the structured failure message and keeps the picker open. Remove the provider picker’s apply-then-probe rollback path. Failover calls activation with `requireTools: true` and `allowSlow: false`.

- [ ] **Step 4: Run the full Tovyr suite**

Run: `bun test services/tovyr`

Expected: all tests PASS.

- [ ] **Step 5: Commit the call-site migration**

Commit task files with message `fix: unify model selection behavior`.

### Task 6: Honest picker readiness presentation and live smoke verification

**Files:**
- Modify: `components/tovyr/TovyrModelSelector.tsx`
- Modify: `components/tovyr/TovyrProviderModelPicker.tsx`
- Modify: `services/tovyr/catalogModels.ts`
- Modify: `services/tovyr/catalogModels.test.ts`
- Modify: `docs/GUIDE.md`

**Interfaces:**
- Consumes: `ModelReadinessRecord` and canonical model display names.
- Produces: grouped, textual readiness badges and explicit slow-model confirmation.

- [ ] **Step 1: Add failing picker-model projection tests**

Create and test `buildModelPickerRows` with records for ready, chat-only, slow, unavailable, unsuitable, and unverified models. Assert inventory-only rows say `listed`, never `live`.

- [ ] **Step 2: Run picker projection tests**

Run: `bun test services/tovyr/catalogModels.test.ts`

Expected: FAIL because current descriptions use `live`/`fallback` and lack readiness groups.

- [ ] **Step 3: Implement grouped readiness rows**

Render state text and evidence source. Slow selection opens a second confirmation; unavailable and unsuitable rows are visible only in an expandable diagnostic group and cannot be selected for agent use.

- [ ] **Step 4: Run automated and configured-provider smoke checks**

Run: `bun test services/tovyr`

Then run a source-only probe script that prints provider ID, model ID, provider state, model state, latency, and capability booleans without keys. Expected for the reproduced NIM timeout: provider `reachable`, model `slow`, not `ready`.

- [ ] **Step 5: Commit picker/readiness UX**

Commit task files with message `feat: show honest model readiness`.

