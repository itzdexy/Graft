# Tovyr Agent Harness 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Tovyr's cross-session, autonomous multi-agent harness and remove forced GC from active runs while preserving the compact terminal UX and safety model.

**Architecture:** Finish the dormant UDS/named-pipe transport and connect it to the existing mailbox, session registry, `SendMessage`, and a new `ListPeers` tool. Enable the existing classifier-backed auto mode, add deterministic frontier-model role affinity, and replace the one-second forced-GC loop with an idle/pressure-aware scheduler.

**Tech Stack:** Bun, TypeScript, Node `net`, React/Ink, Zod, Bun test

**Spec:** `docs/superpowers/specs/2026-08-29-tovyr-agent-harness-2-design.md`

## Global Constraints

- Run through Bun/source CLI only; never launch `tovyr.exe`.
- Preserve all existing user changes in the dirty worktree.
- Keep `/plan`, `/code`, `/safe`, and `/bypass` semantics unchanged.
- Auto mode must not bypass destructive-command, unusual-shell, secret-path, or remote-message safeguards.
- IPC frames are newline-delimited JSON and capped at 256 KiB.
- Do not add a second live spinner or activity surface.
- Treat 2× lower CPU as a benchmark target, not an unsupported universal claim.

---

### Task 1: Local Session Transport and Peer Discovery

**Files:**
- Create: `utils/udsMessaging.ts`
- Create: `utils/udsClient.ts`
- Create: `utils/peerRegistry.ts`
- Create: `utils/udsMessaging.test.ts`
- Create: `utils/peerRegistry.test.ts`
- Modify: `utils/concurrentSessions.ts`
- Modify: `context/mailbox.tsx`
- Modify: `setup.ts`
- Modify: `utils/features.ts`

**Interfaces:**
- Produces: `startUdsMessaging(path, options)`, `getDefaultUdsSocketPath()`, `getUdsMessagingSocketPath()`, `subscribeUdsMessages(listener)`, `sendToUdsSocket(path, text)`, and `listSessionPeers()`.
- Consumes: existing session IDs, config home, cleanup registry, PID liveness, and `Mailbox.send`.

- [ ] **Step 1: Write failing transport and registry tests**

```ts
test('queues a validated peer message and rejects an oversized frame', async () => {
  const received: SessionEnvelope[] = []
  const unsubscribe = subscribeUdsMessages(message => received.push(message))
  await sendToUdsSocket(getUdsMessagingSocketPath(), 'review this change')
  expect(received[0]?.text).toBe('review this change')
  await expect(sendToUdsSocket(path, 'x'.repeat(MAX_FRAME_BYTES + 1))).rejects.toThrow()
  unsubscribe()
})
```

- [ ] **Step 2: Run tests and confirm missing-module/API failures**

Run: `bun test utils/udsMessaging.test.ts utils/peerRegistry.test.ts`

- [ ] **Step 3: Implement the versioned bounded JSONL transport and peer registry**

```ts
export type SessionEnvelope = {
  version: 1
  type: 'message'
  id: string
  from: { sessionId: string; address: string; name?: string }
  text: string
  sentAt: string
}
```

- [ ] **Step 4: Connect received envelopes to the React mailbox and start IPC for interactive source sessions**

```ts
useEffect(() => subscribeUdsMessages(envelope => mailbox.send({
  id: envelope.id,
  source: 'teammate',
  from: envelope.from.address,
  content: wrapCrossSessionMessage(envelope),
  timestamp: envelope.sentAt,
})), [mailbox])
```

- [ ] **Step 5: Run focused transport tests**

Run: `bun test utils/udsMessaging.test.ts utils/peerRegistry.test.ts utils/concurrentSessions.test.ts`

### Task 2: Peer Tools and Durable Agent Messaging

**Files:**
- Create: `tools/ListPeersTool/ListPeersTool.ts`
- Create: `tools/ListPeersTool/constants.ts`
- Create: `tools/ListPeersTool/prompt.ts`
- Create: `tools/ListPeersTool/ListPeersTool.test.ts`
- Create: `commands/peers/index.ts`
- Create: `commands/peers/peers.tsx`
- Modify: `tools/SendMessageTool/SendMessageTool.ts`
- Modify: `tools/SendMessageTool/prompt.ts`
- Modify: `tools.ts`
- Modify: `commands.ts`

**Interfaces:**
- Consumes: `listSessionPeers()` and `sendToUdsSocket()` from Task 1.
- Produces: model-visible `ListPeers`, user-visible `/peers`, and cross-session `SendMessage` in the normal and simple toolsets.

- [ ] **Step 1: Write failing tool tests**

```ts
test('lists live peers with directly reusable addresses', async () => {
  const result = await ListPeersTool.call({}, context, canUseTool, parent)
  expect(result.data.peers[0]).toMatchObject({ address: expect.stringMatching(/^uds:/) })
})
```

- [ ] **Step 2: Run tests and confirm `ListPeersTool` is absent**

Run: `bun test tools/ListPeersTool/ListPeersTool.test.ts tools/SendMessageTool/SendMessageTool.test.ts`

- [ ] **Step 3: Implement the tool, command, and normal/simple tool registration**

```ts
const getListPeersTool = () => require('./tools/ListPeersTool/ListPeersTool.js').ListPeersTool
```

- [ ] **Step 4: Make plain-text session delivery available without requiring a swarm team**

```ts
isEnabled() {
  return isAgentSwarmsEnabled() || feature('UDS_INBOX')
}
```

- [ ] **Step 5: Run peer and messaging tests**

Run: `bun test tools/ListPeersTool/ListPeersTool.test.ts tools/SendMessageTool/SendMessageTool.test.ts`

### Task 3: Safe Auto Mode and Frontier Role Routing

**Files:**
- Create: `commands/auto/index.ts`
- Create: `commands/auto/auto.tsx`
- Modify: `services/tovyr/modes.ts`
- Modify: `services/tovyr/modes.test.ts`
- Modify: `services/tovyr/agent/roleRouter.ts`
- Modify: `services/tovyr/agent/roleRouter.test.ts`
- Modify: `utils/features.ts`
- Modify: `commands.ts`

**Interfaces:**
- Produces: `enterAutoMode(...)` and role routing that scores ready tool-capable Fable/Opus-family models without pinning versions.
- Consumes: existing auto-mode gate checks, permission transitions, readiness records, and role assignments.

- [ ] **Step 1: Add failing mode and routing tests**

```ts
test('prefers Fable planning and Opus verification when both are ready', () => {
  const result = assignOrchestrationRoles({ providerId: 'anthropic', models })
  expect(result.ok && result.assignments.planner.modelId).toContain('fable')
  expect(result.ok && result.assignments.verifier.modelId).toContain('opus')
})
```

- [ ] **Step 2: Run tests and verify the old generic sorting fails the affinity assertion**

Run: `bun test services/tovyr/modes.test.ts services/tovyr/agent/roleRouter.test.ts`

- [ ] **Step 3: Implement `/auto` through the existing guarded permission transition**

```ts
if (!toolPermissionContext.isAutoModeAvailable || !isAutoModeGateEnabled()) {
  onDone(getAutoModeUnavailableNotification(getAutoModeUnavailableReason()))
  return
}
```

- [ ] **Step 4: Add family affinity as a secondary deterministic routing signal**

```ts
const affinity = (modelId: string, role: OrchestrationRole) =>
  /fable/i.test(modelId) && role === 'planner' ? 40 :
  /opus/i.test(modelId) && role === 'verifier' ? 40 : 0
```

- [ ] **Step 5: Run mode, permission, and orchestration tests**

Run: `bun test services/tovyr/modes.test.ts services/tovyr/agent/roleRouter.test.ts services/tovyr/agent/adaptiveOrchestration.test.ts utils/permissions/getNextPermissionMode.test.ts`

### Task 4: Idle-Only GC and CPU Wakeup Reduction

**Files:**
- Create: `utils/idleGcScheduler.ts`
- Create: `utils/idleGcScheduler.test.ts`
- Modify: `cli/print.ts`
- Modify: `utils/backgroundHousekeeping.ts`
- Modify: `scripts/tovyr-bench.js`

**Interfaces:**
- Produces: `startIdleGcScheduler(options?)` with injected clock, activity, heap, and collect functions for deterministic tests.
- Consumes: `getLastInteractionTime()`, `process.memoryUsage()`, and optional `Bun.gc`.

- [ ] **Step 1: Write failing scheduler tests**

```ts
test('never forces GC during active work and coalesces idle collection', () => {
  const scheduler = createIdleGcScheduler({ collect, now, lastActivityAt, heapUsed })
  scheduler.tick()
  expect(collect).not.toHaveBeenCalled()
  advancePastIdleGraceWithHighHeap()
  scheduler.tick()
  scheduler.tick()
  expect(collect).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run the scheduler test and confirm the module is missing**

Run: `bun test utils/idleGcScheduler.test.ts`

- [ ] **Step 3: Implement idle grace, heap threshold, cooldown, and unref'ed sampling**

```ts
if (now() - lastActivityAt() < idleGraceMs) return false
if (heapUsed() < heapThresholdBytes) return false
if (now() - lastCollectionAt < cooldownMs) return false
collect(true)
```

- [ ] **Step 4: Remove the one-second active-run GC interval and start the scheduler from interactive housekeeping**

- [ ] **Step 5: Extend benchmarks with CPU usage and run focused tests**

Run: `bun test utils/idleGcScheduler.test.ts && npm run bench`

### Task 5: Integrated Harness Verification and Documentation

**Files:**
- Modify: `docs/GUIDE.md`
- Modify: `README.md`
- Test: existing activity, orchestration, permission, transport, and CLI suites

**Interfaces:**
- Consumes every preceding task.
- Produces documented `/auto`, `/peers`, `ListPeers`, `SendMessage`, named subagent resume, and performance behavior.

- [ ] **Step 1: Add user documentation with exact commands and safety boundaries**

```md
/peers                 List live local Tovyr sessions
/auto                  Classifier-guarded autonomous mode
SendMessage to uds:…   Message a listed local coding agent
```

- [ ] **Step 2: Run focused feature tests**

Run: `bun test utils/udsMessaging.test.ts utils/peerRegistry.test.ts tools/ListPeersTool/ListPeersTool.test.ts services/tovyr/modes.test.ts services/tovyr/agent/roleRouter.test.ts utils/idleGcScheduler.test.ts components/tovyr/TovyrActivitySurface.test.ts services/tovyr/dx/turnActivity.test.ts`

- [ ] **Step 3: Run static and product quality gates**

Run: `npm run typecheck && npm run check:tovyr`

- [ ] **Step 4: Run the source CLI benchmark**

Run: `npm run bench`

- [ ] **Step 5: Review the final diff against the specification and report measured evidence and any remaining limitations**

Run: `git diff --check -- utils/udsMessaging.ts utils/udsClient.ts utils/peerRegistry.ts tools/ListPeersTool commands/peers commands/auto utils/idleGcScheduler.ts cli/print.ts utils/backgroundHousekeeping.ts services/tovyr/modes.ts services/tovyr/agent/roleRouter.ts tools.ts commands.ts docs/GUIDE.md README.md`
