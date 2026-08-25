# Tovyr Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a reliable, original, keyboard-first Tovyr coding workbench whose source CLI can plan, edit, diagnose, verify, recover, remember, and resume real developer work.

**Architecture:** Preserve the Bun/React/Ink runtime and introduce small Tovyr-owned domain/view-model boundaries between the large inherited REPL and presentation. Complete existing activity, provider, agent, session, permission, and UI work in sequential release gates; each gate leaves the source CLI runnable and independently testable.

**Tech Stack:** Bun 1.3+, TypeScript, React 19, Ink 7, Bun test, existing Tovyr provider/runtime services, PowerShell/Windows-first source launch

**Spec:** `docs/superpowers/specs/2026-08-24-tovyr-workbench-design.md`

## Global Constraints

- Run and test `bun run entrypoints/cli.tsx`; never launch or depend on `tovyr.exe`.
- Preserve the dirty worktree and never discard user changes.
- Bare `tovyr` launches interactive mode; help is `tovyr --help`.
- `/init` creates `tovyr.md`; `/plan` writes `tovyrplan.md`; `/code` implements it.
- Use `/model`, never `/models`, and list only models for the active connected provider.
- FreeModel authentication is `tovyr auth login --key`; do not reintroduce legacy web OAuth.
- Provider failover remains disabled unless `TOVYR_AUTO_FAILOVER=1`.
- The active mode remains visible in the prompt footer bottom-right.
- Ask and Code auto-accept Write/Edit and allowlisted developer shell commands; unusual, destructive, external, secret-path, and credential-bearing actions ask.
- Plan mode is read-only except for planning artifacts.
- Exactly one live activity surface renders per turn.
- All UI supports narrow terminals, `NO_COLOR`, `TERM=dumb`, CI, and reduced motion.
- No raw product gradients, decorative AI iconography, fake progress, or cloned third-party identity.
- Every production behavior change starts with a failing test and finishes with fresh focused plus regression verification.
- Do not publish, push, or expose credentials.

## Locked File Structure

### Foundation

- `utils/tovyrRuntime.ts` — source/runtime identity only.
- `tsconfig.tovyr.json` — meaningful Tovyr-owned typecheck boundary.
- `scripts/tovyr-quality-gates.js` — deterministic composition of Tovyr checks.
- `test-support/renderInk.tsx` — terminal render harness.
- `test-support/tovyrScenario.ts` — isolated disposable-project scenario runner.

### Workbench and Discovery

- `services/tovyr/dx/workbench.ts` — pure layout/focus/context view model.
- `services/tovyr/dx/commandIndex.ts` — one searchable command and shortcut index.
- `components/tovyr/TovyrWorkbenchShell.tsx` — adaptive shell composition.
- `components/tovyr/TovyrContextRail.tsx` — project/session/provider/git context.
- `components/tovyr/TovyrFocusSurface.tsx` — plan/diff/file/tool/agent/memory focus router.
- `components/tovyr/TovyrCommandPalette.tsx` and `TovyrHelpOverlay.tsx` — projections of the shared index.

### Execution UX

- `services/tovyr/dx/turnActivity.ts` and `activityAdapter.ts` — single active-turn model.
- `services/tovyr/dx/permissionPresentation.ts` — pure permission/resource/risk projection.
- `components/tovyr/TovyrPermissionCard.tsx` — bounded approval UI with sticky actions.
- `services/tovyr/git/checkpoint.ts` — recoverable Tovyr snapshot/checkpoint API.
- `services/tovyr/agent/runState.ts` — inspect/plan/edit/diagnose/repair/verify/review lifecycle.
- `services/tovyr/execution/backend.ts` and `localBackend.ts` — typed local process boundary.

### Knowledge and Reliability

- `services/tovyr/sessions/sessionIndex.ts` — project session list/search/fork projection.
- `services/tovyr/knowledge/catalog.ts` — inspectable memory/skill provenance catalog.
- Existing provider/model services remain authoritative; UI consumes their readiness and activation results.

---

## Release Gate 1 — Foundation

### Task 1: Fix source runtime identity

**Files:**
- Modify: `utils/tovyrRuntime.ts`
- Modify: `utils/tovyrRuntime.test.ts`
- Test: `services/tovyr/launcherStartupContract.test.ts`

**Interfaces:**
- Consumes: `import.meta.url`, `process.env.TOVYR_PACKAGE_ROOT`, `TOVYR_SRC`, and `TOVYR_FORCE_INTERACTIVE`.
- Produces: `isTovyrRuntime(): boolean` with deterministic source-package detection.

- [ ] **Step 1: Extend the failing test to cover both package lookup and environment fallbacks**

```ts
test('recognizes the source package without launcher environment', () => {
  delete process.env.TOVYR_PACKAGE_ROOT
  delete process.env.TOVYR_SRC
  delete process.env.TOVYR_FORCE_INTERACTIVE
  expect(isTovyrRuntime()).toBe(true)
})

test('recognizes an explicit source root', () => {
  process.env.TOVYR_SRC = import.meta.dir
  expect(isTovyrRuntime()).toBe(true)
})
```

- [ ] **Step 2: Run the focused test and record the expected failure**

Run: `bun test utils/tovyrRuntime.test.ts`

Expected: the source-package case fails with `Expected: true, Received: false`.

- [ ] **Step 3: Replace CommonJS-relative lookup with URL-relative JSON reading**

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function isTovyrPackage(): boolean {
  try {
    const path = fileURLToPath(new URL('../package.json', import.meta.url))
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as { name?: string }
    return pkg.name === 'tovyr' || pkg.name === 'tovyrcode'
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Verify focused and startup contracts**

Run: `bun test utils/tovyrRuntime.test.ts services/tovyr/launcherStartupContract.test.ts`

Expected: both files pass with zero failures.

- [ ] **Step 5: Commit only the task files**

```powershell
git add -- utils/tovyrRuntime.ts utils/tovyrRuntime.test.ts services/tovyr/launcherStartupContract.test.ts
git commit -m "fix: detect Tovyr source runtime reliably"
```

### Task 2: Establish meaningful Tovyr quality gates

**Files:**
- Create: `tsconfig.tovyr.json`
- Create: `scripts/tovyr-quality-gates.js`
- Create: `scripts/tovyr-quality-gates.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: focused Tovyr source directories and package scripts.
- Produces: `bun run typecheck:tovyr` and `bun run check:tovyr` without pretending the inherited global project is clean.

- [ ] **Step 1: Write a failing script-contract test**

```js
import { expect, test } from 'bun:test'
import pkg from '../package.json'

test('Tovyr exposes focused quality gates', () => {
  expect(pkg.scripts['typecheck:tovyr']).toBe('tsc -p tsconfig.tovyr.json')
  expect(pkg.scripts['check:tovyr']).toBe('node scripts/tovyr-quality-gates.js')
})
```

- [ ] **Step 2: Run the test and verify the scripts are absent**

Run: `bun test scripts/tovyr-quality-gates.test.js`

Expected: FAIL because both package scripts are `undefined`.

- [ ] **Step 3: Add the focused config and sequential gate runner**

```json
{
  "extends": "./tsconfig.typecheck.json",
  "include": [
    "components/tovyr/**/*.ts",
    "components/tovyr/**/*.tsx",
    "services/tovyr/**/*.ts",
    "commands/tovyr/**/*.ts",
    "commands/tovyr/**/*.tsx",
    "utils/tovyrRuntime.ts",
    "test-support/**/*.ts",
    "test-support/**/*.tsx"
  ],
  "exclude": ["**/*.test.ts", "**/*.test.tsx"]
}
```

```js
import { spawnSync } from 'node:child_process'

const commands = [
  ['bun', ['test']],
  ['bun', ['run', 'typecheck:tovyr']],
  ['bun', ['run', 'check:dead-ui']],
  ['bun', ['run', 'check:brand']],
]
for (const [file, args] of commands) {
  const result = spawnSync(file, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
```

Add package scripts exactly as asserted by the test.

- [ ] **Step 4: Run the contract, focused typecheck, and composed gate**

Run: `bun test scripts/tovyr-quality-gates.test.js && bun run typecheck:tovyr && bun run check:tovyr`

Expected: each command exits zero; if the focused include exposes existing Tovyr diagnostics, fix those diagnostics in their owning files before proceeding rather than widening exclusions.

- [ ] **Step 5: Commit the quality boundary**

```powershell
git add -- tsconfig.tovyr.json scripts/tovyr-quality-gates.js scripts/tovyr-quality-gates.test.js package.json
git commit -m "test: define Tovyr quality gates"
```

### Task 3: Harden the terminal render harness

**Files:**
- Modify: `test-support/renderInk.tsx`
- Modify: `test-support/renderInk.test.tsx`

**Interfaces:**
- Consumes: React nodes, terminal columns/rows, environment overrides, and optional AppState.
- Produces: `renderToText(node, options): Promise<RenderResult>` with final-frame text and bounded cleanup.

- [ ] **Step 1: Write failing final-frame and environment-isolation tests**

```ts
test('returns the last painted frame separately', async () => {
  const result = await renderToText(React.createElement(Text, null, 'ready'))
  expect(result.lastFrame).toContain('ready')
})

test('restores terminal environment overrides', async () => {
  const before = process.env.NO_COLOR
  await renderToText(React.createElement(Text, null, 'plain'), { env: { NO_COLOR: '1' } })
  expect(process.env.NO_COLOR).toBe(before)
})
```

- [ ] **Step 2: Run and confirm the missing result/options fail**

Run: `bun test test-support/renderInk.test.tsx`

Expected: FAIL because `lastFrame` and `env` do not exist.

- [ ] **Step 3: Add environment restoration and last-frame extraction**

```ts
export type RenderResult = { output: string; raw: string; lastFrame: string }

const previous = new Map<string, string | undefined>()
for (const [key, value] of Object.entries(options.env ?? {})) {
  previous.set(key, process.env[key])
  process.env[key] = value
}
try {
  // existing render, settle, and unmount path
  const raw = stdout.frames.join('')
  return { output: stripAnsi(raw), raw, lastFrame: stripAnsi(stdout.frames.at(-1) ?? '') }
} finally {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}
```

- [ ] **Step 4: Run harness and existing Tovyr component tests**

Run: `bun test test-support components/tovyr`

Expected: zero failures and no hanging Ink instances.

- [ ] **Step 5: Commit the harness**

```powershell
git add -- test-support/renderInk.tsx test-support/renderInk.test.tsx
git commit -m "test: harden Tovyr terminal rendering"
```

## Release Gate 2 — Adaptive Shell and Discovery

### Task 4: Define the pure workbench view model

**Files:**
- Create: `services/tovyr/dx/workbench.ts`
- Create: `services/tovyr/dx/workbench.test.ts`

**Interfaces:**
- Produces: `WorkbenchFocus`, `WorkbenchInput`, `WorkbenchView`, and `deriveWorkbenchView(input): WorkbenchView`.
- Consumers: `TovyrWorkbenchShell`, focus routing, and responsive tests.

- [ ] **Step 1: Write failing breakpoint and focus-priority tests**

```ts
import { deriveWorkbenchView } from './workbench.js'

test('narrow terminals never reserve a side panel', () => {
  expect(deriveWorkbenchView({ columns: 59, rows: 30, requestedFocus: 'plan', approvalPending: false }).panel).toBe('overlay')
})

test('approval overrides requested focus', () => {
  expect(deriveWorkbenchView({ columns: 140, rows: 40, requestedFocus: 'diff', approvalPending: true }).focus).toBe('permission')
})
```

- [ ] **Step 2: Run the missing-module test**

Run: `bun test services/tovyr/dx/workbench.test.ts`

Expected: FAIL because `workbench.ts` does not exist.

- [ ] **Step 3: Implement the deterministic view model**

```ts
export type WorkbenchFocus = 'none' | 'permission' | 'plan' | 'diff' | 'file' | 'tool' | 'agents' | 'memory'
export type WorkbenchView = { density: 'compact' | 'normal' | 'wide'; panel: 'none' | 'overlay' | 'side'; focus: WorkbenchFocus; showHeader: boolean }

export function deriveWorkbenchView(input: WorkbenchInput): WorkbenchView {
  const focus = input.approvalPending ? 'permission' : input.requestedFocus
  const density = input.columns < 60 ? 'compact' : input.columns < 120 ? 'normal' : 'wide'
  return {
    density,
    focus,
    panel: focus === 'none' ? 'none' : density === 'wide' ? 'side' : 'overlay',
    showHeader: input.rows >= 16,
  }
}
```

- [ ] **Step 4: Verify width, height, and focus cases**

Run: `bun test services/tovyr/dx/workbench.test.ts`

Expected: all cases pass.

- [ ] **Step 5: Commit the view model**

```powershell
git add -- services/tovyr/dx/workbench.ts services/tovyr/dx/workbench.test.ts
git commit -m "feat: model adaptive Tovyr workbench"
```

### Task 5: Unify commands, palette, help, and hint rail

**Files:**
- Create: `services/tovyr/dx/commandIndex.ts`
- Create: `services/tovyr/dx/commandIndex.test.ts`
- Modify: `components/tovyr/TovyrCommandPalette.tsx`
- Modify: `components/tovyr/TovyrHelpOverlay.tsx`
- Modify: `components/tovyr/TovyrKeyHintBar.tsx`

**Interfaces:**
- Consumes: runtime `Command[]` and implemented keybindings.
- Produces: `buildCommandIndex(commands): CommandIndexEntry[]`, `shortcutGroups(entries)`, and palette groups from the same entries.

- [ ] **Step 1: Write failing parity tests**

```ts
test('does not advertise missing shortcuts', () => {
  const entries = buildCommandIndex([], { keybindings: ['ctrl+p', 'shift+tab', '?', 'esc'] })
  expect(entries.filter(entry => entry.kind === 'shortcut').map(entry => entry.keys)).toEqual(['ctrl+p', 'shift+tab', '?', 'esc'])
})

test('uses singular model command', () => {
  expect(buildCommandIndex(commands).some(entry => entry.name === '/models')).toBe(false)
  expect(buildCommandIndex(commands).some(entry => entry.name === '/model')).toBe(true)
})
```

- [ ] **Step 2: Run and observe missing index failure**

Run: `bun test services/tovyr/dx/commandIndex.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement indexed entries and replace hard-coded groups**

```ts
export type CommandIndexEntry = {
  kind: 'command' | 'shortcut'
  name: string
  description: string
  category: 'Coding' | 'Context' | 'Models' | 'Sessions' | 'Tools' | 'Settings' | 'Help'
  keys?: string
  command?: Command
}

export function searchCommandIndex(entries: CommandIndexEntry[], query: string): CommandIndexEntry[] {
  const needle = query.replace(/^\//, '').trim().toLowerCase()
  return entries.filter(entry => !needle || `${entry.name} ${entry.description} ${entry.category}`.toLowerCase().includes(needle))
}
```

Make the palette, help overlay, and hint bar render projections of this index; delete their duplicate hard-coded shortcut/category tables.

- [ ] **Step 4: Run index and UI tests**

Run: `bun test services/tovyr/dx/commandIndex.test.ts components/tovyr/TovyrCommandPalette.test.ts components/tovyr/TovyrKeyHintBar.test.ts`

Expected: zero failures; `/model`, Ctrl+P, Shift+Tab, `?`, and Esc appear once in the shared index.

- [ ] **Step 5: Commit discovery parity**

```powershell
git add -- services/tovyr/dx/commandIndex.ts services/tovyr/dx/commandIndex.test.ts components/tovyr/TovyrCommandPalette.tsx components/tovyr/TovyrHelpOverlay.tsx components/tovyr/TovyrKeyHintBar.tsx
git commit -m "feat: unify Tovyr command discovery"
```

### Task 6: Build and mount the adaptive shell

**Files:**
- Create: `components/tovyr/TovyrWorkbenchShell.tsx`
- Create: `components/tovyr/TovyrWorkbenchShell.test.tsx`
- Create: `components/tovyr/TovyrContextRail.tsx`
- Create: `components/tovyr/TovyrFocusSurface.tsx`
- Modify: `screens/REPL.tsx`
- Modify: `components/LogoV2/LogoV2.tsx`

**Interfaces:**
- Consumes: `WorkbenchView`, transcript node, composer node, optional focus node, project/provider/session facts.
- Produces: one responsive shell mounted by the Tovyr REPL path.

- [ ] **Step 1: Write failing render and source-contract tests**

```ts
test('renders transcript and composer at 50 columns without a side rail', async () => {
  const { output } = await renderToText(<TovyrWorkbenchShell input={compactInput} transcript={<Text>chat</Text>} composer={<Text>prompt</Text>} />, { columns: 50 })
  expect(output).toContain('chat')
  expect(output).toContain('prompt')
  expect(output).not.toContain('│ plan')
})

test('renders requested focus beside transcript when wide', async () => {
  const { output } = await renderToText(<TovyrWorkbenchShell input={widePlanInput} transcript={<Text>chat</Text>} composer={<Text>prompt</Text>} focus={<Text>plan steps</Text>} />, { columns: 140 })
  expect(output).toContain('plan steps')
})
```

- [ ] **Step 2: Run and verify the missing component**

Run: `bun test components/tovyr/TovyrWorkbenchShell.test.tsx`

Expected: FAIL because the shell does not exist.

- [ ] **Step 3: Implement the shell and mount it only for Tovyr**

```tsx
export function TovyrWorkbenchShell(props: Props): ReactNode {
  const view = deriveWorkbenchView(props.input)
  return (
    <Box flexDirection="column" width="100%" height="100%">
      {view.showHeader ? <TovyrContextRail {...props.context} /> : null}
      <Box flexDirection="row" flexGrow={1} overflow="hidden">
        <Box flexDirection="column" flexGrow={1}>{props.transcript}</Box>
        {view.panel === 'side' && props.focus ? <TovyrFocusSurface focus={view.focus}>{props.focus}</TovyrFocusSurface> : null}
      </Box>
      {view.panel === 'overlay' && props.focus ? <TovyrFocusSurface focus={view.focus}>{props.focus}</TovyrFocusSurface> : null}
      {props.composer}
    </Box>
  )
}
```

Extract the Tovyr-specific REPL composition into this shell without moving inherited non-Tovyr behavior. Keep `TovyrWorkspaceDashboard` as the initial transcript empty state.

- [ ] **Step 4: Run shell, dashboard, and startup tests**

Run: `bun test components/tovyr/TovyrWorkbenchShell.test.tsx components/tovyr/TovyrWorkspaceDashboard.ambient.test.ts services/tovyr/launcherStartupContract.test.ts`

Expected: zero failures at 50, 80, and 140 columns.

- [ ] **Step 5: Commit the mounted shell**

```powershell
git add -- components/tovyr/TovyrWorkbenchShell.tsx components/tovyr/TovyrWorkbenchShell.test.tsx components/tovyr/TovyrContextRail.tsx components/tovyr/TovyrFocusSurface.tsx screens/REPL.tsx components/LogoV2/LogoV2.tsx
git commit -m "feat: mount adaptive Tovyr workbench"
```

### Task 7: Resolve every baselined dead Tovyr component

**Files:**
- Modify: `scripts/check-dead-ui.js`
- Modify or delete: the twelve exports listed in `BASELINE`
- Test: `scripts/check-dead-ui.test.js`

**Interfaces:**
- Consumes: mounted workbench regions from Task 6.
- Produces: an empty `BASELINE` and a hard failure for any new unreferenced Tovyr component/warmer.

- [ ] **Step 1: Write a failing zero-baseline contract**

```js
test('dead UI baseline is empty', () => {
  const source = readFileSync('scripts/check-dead-ui.js', 'utf8')
  expect(source).toContain('const BASELINE = new Set([])')
})
```

- [ ] **Step 2: Run and confirm the current twelve-entry baseline fails**

Run: `bun test scripts/check-dead-ui.test.js`

Expected: FAIL because the baseline contains twelve names.

- [ ] **Step 3: Integrate or delete each export deliberately**

Use this fixed disposition:

```text
TovyrAgentHud + TovyrAgentStepProgress -> agents focus surface
TovyrCodeAcceptancePanel              -> diff/review focus surface
TovyrCostMeter + TovyrSessionHeader   -> context rail
TovyrEmptyState                       -> transcript empty state
TovyrFileSidebar                      -> file focus surface
TovyrNotifications + TovyrStatusBar   -> context rail/status projection
TovyrSpinnerStatusRow                 -> delete; TovyrActivitySurface owns live state
TovyrWelcomePanel                     -> delete; TovyrWorkspaceDashboard owns welcome
warmUpCache                           -> delete if no startup caller requires it
```

After the disposition, change the baseline to `const BASELINE = new Set([])`; do not add replacement exceptions.

- [ ] **Step 4: Run dead-UI, source-contract, and Tovyr UI tests**

Run: `bun test scripts/check-dead-ui.test.js components/tovyr services/tovyr/launcherStartupContract.test.ts && bun run check:dead-ui`

Expected: `check-dead-ui: no NEW unreferenced components (0 baselined).`

- [ ] **Step 5: Commit the dead-UI cleanup**

```powershell
git add -- scripts/check-dead-ui.js scripts/check-dead-ui.test.js components/tovyr services/tovyr/launcherStartupContract.test.ts
git commit -m "refactor: finish Tovyr workbench components"
```

## Release Gate 3 — Execution UX

### Task 8: Finish one truthful activity and evidence path

**Files:**
- Modify: `services/tovyr/dx/turnActivity.ts`
- Modify: `services/tovyr/dx/activityAdapter.ts`
- Modify: `components/tovyr/TovyrActivitySurface.tsx`
- Modify: `components/tovyr/TovyrChatDock.tsx`
- Modify: `components/messages/AssistantThinkingMessage.tsx`
- Modify: `components/messages/AssistantToolUseMessage.tsx`
- Test: corresponding `*.test.ts` and `*.test.tsx` files

**Interfaces:**
- Consumes: actual stream/tool/permission/search/orchestration events.
- Produces: one `TovyrTurnActivity | null`, one live renderer, and static completed evidence.

- [ ] **Step 1: Add failing exclusivity and no-fabrication tests**

```ts
test('a permission wait replaces tool animation but keeps tool evidence', () => {
  const next = reduceTurnActivity(tooling, { type: 'permission_requested', summary: 'Run bun test', at: 3 })
  expect(next?.kind).toBe('waiting_for_permission')
  expect(next?.evidence.some(item => item.label.includes('bun test'))).toBe(true)
})

test('search without result metadata does not invent a count', () => {
  expect(deriveTurnActivity(searchInput)?.label).not.toMatch(/\d+ results/)
})
```

- [ ] **Step 2: Run activity tests and confirm the new assertions fail where behavior is incomplete**

Run: `bun test services/tovyr/dx/turnActivity.test.ts services/tovyr/dx/activityAdapter.test.ts components/tovyr/TovyrActivitySurface.test.ts`

Expected: at least one new assertion fails for priority/evidence behavior.

- [ ] **Step 3: Complete the reducer/adapter and suppress transcript duplicates**

```ts
const PRIORITY: Record<TovyrActivityKind, number> = {
  thinking: 1, handoff: 2, verifying: 2, searching: 3, reading_source: 3,
  running_tool: 4, recovering: 5, failed: 6, waiting_for_permission: 7, complete: 0,
}
```

Use typed runtime inputs only. Render `TovyrActivitySurface` from `TovyrChatDock`; active transcript thinking/tool components return `null` or static completed content.

- [ ] **Step 4: Verify the activity slice and mounted source contract**

Run: `bun test services/tovyr/dx components/tovyr components/messages/thinkingRender.test.tsx services/tovyr/launcherStartupContract.test.ts`

Expected: one live activity renderer per turn and zero duplicate spinner assertions.

- [ ] **Step 5: Commit the activity path**

```powershell
git add -- services/tovyr/dx components/tovyr components/messages/AssistantThinkingMessage.tsx components/messages/AssistantToolUseMessage.tsx services/tovyr/launcherStartupContract.test.ts
git commit -m "fix: keep one truthful Tovyr activity"
```

### Task 9: Add bounded permission presentation and restrictive child policy

**Files:**
- Create: `services/tovyr/dx/permissionPresentation.ts`
- Create: `services/tovyr/dx/permissionPresentation.test.ts`
- Create: `components/tovyr/TovyrPermissionCard.tsx`
- Create: `components/tovyr/TovyrPermissionCard.test.tsx`
- Modify: `services/tovyr/permissions/toolGate.ts`
- Modify: `screens/REPL.tsx`

**Interfaces:**
- Produces: `presentPermission(request): PermissionPresentation` and `intersectPermissionCeiling(parent, child): PermissionRule[]`.
- UI choices: `once | session | workspace | deny` plus optional feedback.

- [ ] **Step 1: Write failing long-command and child-ceiling tests**

```ts
test('keeps actions visible for a 4000-character command', () => {
  const view = presentPermission({ action: 'shell', resource: 'x'.repeat(4000), cwd: 'C:\\repo', agent: 'build' })
  expect(view.preview.length).toBeLessThanOrEqual(320)
  expect(view.actions).toEqual(['once', 'session', 'workspace', 'deny'])
})

test('child cannot widen a parent deny', () => {
  expect(evaluate(intersectPermissionCeiling(parentDenyEdit, childAllowEdit), 'edit', 'src/a.ts')).toBe('deny')
})
```

- [ ] **Step 2: Run and verify missing presentation/ceiling failures**

Run: `bun test services/tovyr/dx/permissionPresentation.test.ts components/tovyr/TovyrPermissionCard.test.tsx`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement the pure projection, sticky action row, and policy intersection**

```ts
export type PermissionPresentation = {
  title: string
  preview: string
  detail: string
  risk: 'low' | 'medium' | 'high' | 'destructive'
  actions: Array<'once' | 'session' | 'workspace' | 'deny'>
}

export function intersectEffect(parent: PermissionEffect, child: PermissionEffect): PermissionEffect {
  if (parent === 'deny' || child === 'deny') return 'deny'
  if (parent === 'ask' || child === 'ask') return 'ask'
  return 'allow'
}
```

The card truncates/wraps content inside a bounded body while rendering actions in the existing sticky footer slot.

- [ ] **Step 4: Run permission, shell-risk, render, and REPL contract tests**

Run: `bun test services/tovyr/permissions services/tovyr/dx/permissionPresentation.test.ts components/tovyr/TovyrPermissionCard.test.tsx services/tovyr/launcherStartupContract.test.ts`

Expected: zero failures; a child agent cannot escape parent policy.

- [ ] **Step 5: Commit permission UX**

```powershell
git add -- services/tovyr/dx/permissionPresentation.ts services/tovyr/dx/permissionPresentation.test.ts components/tovyr/TovyrPermissionCard.tsx components/tovyr/TovyrPermissionCard.test.tsx services/tovyr/permissions/toolGate.ts screens/REPL.tsx
git commit -m "feat: make Tovyr approvals bounded and explicit"
```

### Task 10: Replace destructive checkpoint undo with recoverable snapshots

**Files:**
- Rewrite: `services/tovyr/git/checkpoint.ts`
- Expand: `services/tovyr/git/checkpoint.test.ts`
- Modify: `commands/tovyr/undo.ts`

**Interfaces:**
- Produces: `createEditCheckpoint(cwd, paths): Promise<CheckpointResult>`, `restoreCheckpoint(cwd, id): Promise<CheckpointResult>`, and `listCheckpoints(cwd)`.
- Storage: `.tovyr/checkpoints/<id>/manifest.json` plus file copies/absence markers.

- [ ] **Step 1: Write failing non-destructive restore tests using a temporary git repository**

```ts
test('restore only touches checkpoint-owned paths and never invokes reset --hard', async () => {
  const checkpoint = await createEditCheckpoint(repo, ['src/a.ts'])
  await writeFile(join(repo, 'src/a.ts'), 'changed')
  await writeFile(join(repo, 'notes.txt'), 'user work')
  await restoreCheckpoint(repo, checkpoint.id!)
  expect(await readFile(join(repo, 'src/a.ts'), 'utf8')).toBe('before')
  expect(await readFile(join(repo, 'notes.txt'), 'utf8')).toBe('user work')
  expect(recordedGitArgs.flat().join(' ')).not.toContain('reset --hard')
})
```

- [ ] **Step 2: Run and verify the current API/behavior fails**

Run: `bun test services/tovyr/git/checkpoint.test.ts`

Expected: FAIL because path-scoped snapshot/restore is unavailable.

- [ ] **Step 3: Implement atomic path-scoped snapshots**

```ts
export type CheckpointManifest = {
  schemaVersion: 1
  id: string
  cwd: string
  createdAt: number
  files: Array<{ path: string; existed: boolean; sha256?: string }>
}
```

Resolve every path inside `cwd`, copy existing files into the checkpoint directory, record absent files, write the manifest atomically, and restore only manifest paths after an explicit dirty-path conflict check. Remove `undoLastTovyrCommit` and every `git reset --hard` call from this module.

- [ ] **Step 4: Run checkpoint and command tests**

Run: `bun test services/tovyr/git/checkpoint.test.ts commands/tovyr`

Expected: zero failures; unrelated dirty files survive restore.

- [ ] **Step 5: Commit safe checkpoints**

```powershell
git add -- services/tovyr/git/checkpoint.ts services/tovyr/git/checkpoint.test.ts commands/tovyr/undo.ts
git commit -m "fix: make Tovyr undo path-scoped and recoverable"
```

### Task 11: Add a typed local execution backend and background-process UI

**Files:**
- Create: `services/tovyr/execution/backend.ts`
- Create: `services/tovyr/execution/localBackend.ts`
- Create: `services/tovyr/execution/localBackend.test.ts`
- Modify: `services/tools/toolExecution.ts`
- Modify: `components/tovyr/TovyrCompactToolRow.tsx`

**Interfaces:**
- Produces: `ExecutionBackend.start(request): Promise<ProcessHandle>`, `poll`, `write`, `wait`, and `kill`.
- Initial implementation: local backend only; no claim of sandbox isolation.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
test('starts, streams, polls, and terminates a local process', async () => {
  const handle = await backend.start({ command: [process.execPath, '-e', "setInterval(()=>console.log('tick'),20)"], cwd: temp })
  expect((await backend.poll(handle.id)).state).toBe('running')
  await backend.kill(handle.id)
  expect((await backend.wait(handle.id)).state).toBe('killed')
})
```

- [ ] **Step 2: Run and confirm the backend is missing**

Run: `bun test services/tovyr/execution/localBackend.test.ts`

Expected: FAIL because backend modules do not exist.

- [ ] **Step 3: Implement the process registry with bounded output**

```ts
export type ProcessState = 'running' | 'exited' | 'failed' | 'killed'
export type ProcessSnapshot = { id: string; state: ProcessState; exitCode?: number; stdoutTail: string; stderrTail: string; startedAt: number }
export interface ExecutionBackend {
  start(request: ProcessRequest): Promise<ProcessHandle>
  poll(id: string): Promise<ProcessSnapshot>
  write(id: string, data: string): Promise<void>
  wait(id: string): Promise<ProcessSnapshot>
  kill(id: string): Promise<ProcessSnapshot>
}
```

Cap each output tail at 64 KiB, pass arguments without shell string concatenation by default, and expose the active process ID/state in `TovyrCompactToolRow`.

- [ ] **Step 4: Run backend, tool execution, and tool-row tests**

Run: `bun test services/tovyr/execution services/tools components/tovyr/toolRowRender.test.tsx`

Expected: zero failures and no orphaned child process after the test.

- [ ] **Step 5: Commit the local backend**

```powershell
git add -- services/tovyr/execution services/tools/toolExecution.ts components/tovyr/TovyrCompactToolRow.tsx
git commit -m "feat: manage Tovyr local processes explicitly"
```

## Release Gate 4 — Coding Agent Runtime

### Task 12: Persist the coding run lifecycle and verification evidence

**Files:**
- Create: `services/tovyr/agent/runState.ts`
- Create: `services/tovyr/agent/runState.test.ts`
- Modify: `services/tovyr/agent/types.ts`
- Modify: `services/tovyr/agent/persistence.ts`
- Modify: `services/tovyr/agent/ExecutionEngine.ts`
- Modify: `services/tovyr/agent/loopGuard.ts`

**Interfaces:**
- Produces: `CodingRunStage`, `CodingEvidence`, `advanceCodingRun`, `recordVerification`, and persisted run state.
- Lifecycle: `understand -> plan -> checkpoint -> edit -> diagnose -> repair -> verify -> review -> complete`.

- [ ] **Step 1: Write failing transition and completion-gate tests**

```ts
test('cannot complete without fresh successful verification', () => {
  const reviewing = runAt('review')
  expect(() => advanceCodingRun(reviewing, { type: 'complete', at: 50 })).toThrow('successful verification')
})

test('identical repeated failure stops after configured limit', () => {
  const stopped = [1, 2, 3].reduce(run => recordFailure(run, 'bun test|exit=1'), initialRun)
  expect(stopped.stopReason).toBe('repeated_failure')
})
```

- [ ] **Step 2: Run and confirm the run state is missing**

Run: `bun test services/tovyr/agent/runState.test.ts`

Expected: FAIL because `runState.ts` does not exist.

- [ ] **Step 3: Implement the reducer and persist it inside `AgentSession`**

```ts
export type CodingEvidence = { command: string; exitCode: number; ranAt: number; summary: string }
export type CodingRun = { stage: CodingRunStage; changedPaths: string[]; evidence: CodingEvidence[]; lastMutationAt?: number; stopReason?: AgentLoopStopReason }

export function hasFreshVerification(run: CodingRun): boolean {
  const latest = run.evidence.at(-1)
  return !!latest && latest.exitCode === 0 && latest.ranAt >= (run.lastMutationAt ?? 0)
}
```

Execution prompts include the current stage and acceptance criteria. Persistence schema migration supplies a safe default when older sessions lack `codingRun`.

- [ ] **Step 4: Run agent, persistence, and orchestration tests**

Run: `bun test services/tovyr/agent`

Expected: zero failures; restart preserves stage and evidence.

- [ ] **Step 5: Commit the coding lifecycle**

```powershell
git add -- services/tovyr/agent
git commit -m "feat: persist Tovyr coding verification lifecycle"
```

### Task 13: Make Plan, Code, Ask, Bypass, and Superthink policy explicit

**Files:**
- Modify: `services/tovyr/modes.ts`
- Modify: `services/tovyr/modes.test.ts`
- Modify: `services/tovyr/intent/buildIntent.ts`
- Modify: `services/tovyr/intent/implementationGuard.ts`
- Modify: `services/tovyr/permissions/toolGate.ts`
- Modify: `components/tovyr/TovyrModeBadge.tsx`
- Create: `components/tovyr/TovyrModeBadge.test.tsx`

**Interfaces:**
- Produces: `resolveTovyrModePolicy(mode): TovyrModePolicy` and natural-language build promotion.

- [ ] **Step 1: Add failing policy-matrix tests**

```ts
test.each([
  ['plan', 'Edit', 'deny'],
  ['plan', 'Write:tovyrplan.md', 'allow'],
  ['code', 'Edit', 'allow'],
  ['code', 'Bash:bun test', 'allow'],
  ['code', 'Bash:Remove-Item -Recurse', 'ask'],
  ['bypassPermissions', 'Read:.env', 'ask'],
])('%s maps %s to %s', (mode, resource, effect) => {
  expect(resolveEffect(mode, resource)).toBe(effect)
})
```

- [ ] **Step 2: Run and observe incomplete matrix behavior**

Run: `bun test services/tovyr/modes.test.ts services/tovyr/intent services/tovyr/permissions`

Expected: at least the planning-artifact or destructive/secret boundary assertion fails.

- [ ] **Step 3: Centralize the policy and remove duplicated mode guesses**

```ts
export type TovyrModePolicy = {
  mode: 'ask' | 'plan' | 'code' | 'bypass' | 'superthink'
  mutation: 'ask' | 'deny' | 'allow'
  planningArtifacts: string[]
  allowlistedShell: boolean
  destructive: 'ask'
  secretPaths: 'ask'
}
```

Map inherited permission mode strings at one boundary. Keep the footer badge label derived from this policy and render it bottom-right through the existing footer layout.

- [ ] **Step 4: Run modes, intent, permissions, and footer tests**

Run: `bun test services/tovyr/modes.test.ts services/tovyr/intent services/tovyr/permissions components/tovyr/TovyrModeBadge.test.tsx components/PromptInput`

Expected: zero failures and all five mode labels are reachable.

- [ ] **Step 5: Commit mode policy**

```powershell
git add -- services/tovyr/modes.ts services/tovyr/modes.test.ts services/tovyr/intent services/tovyr/permissions/toolGate.ts components/tovyr/TovyrModeBadge.tsx
git commit -m "feat: make Tovyr coding modes enforceable"
```

## Release Gate 5 — Sessions, Memory, and Skills

### Task 14: Add a project session index with search, resume, and fork

**Files:**
- Create: `services/tovyr/sessions/sessionIndex.ts`
- Create: `services/tovyr/sessions/sessionIndex.test.ts`
- Create: `components/tovyr/TovyrSessionPicker.tsx`
- Modify: `commands/resume/index.ts`
- Modify: `commands/session/index.ts`
- Modify: `screens/REPL.tsx`

**Interfaces:**
- Produces: `listProjectSessions(cwd)`, `searchProjectSessions(cwd, query)`, and `forkSession(sourceId)`.
- Consumes: existing session transcript metadata and REPL `resume` callback.

- [ ] **Step 1: Write failing project-isolation and search tests**

```ts
test('lists only sessions for the requested project', async () => {
  expect((await listProjectSessions(projectA)).every(item => item.cwd === projectA)).toBe(true)
})

test('search matches title, summary, and transcript snippets', async () => {
  expect((await searchProjectSessions(projectA, 'parser regression'))[0]?.id).toBe('session-a')
})
```

- [ ] **Step 2: Run and confirm the index is missing**

Run: `bun test services/tovyr/sessions/sessionIndex.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement bounded metadata search and fork semantics**

```ts
export type SessionIndexItem = { id: string; cwd: string; title: string; summary: string; updatedAt: number; mode?: string; model?: string }

export function rankSession(item: SessionIndexItem, query: string): number {
  const haystack = `${item.title}\n${item.summary}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0)
}
```

Read only bounded metadata/snippets for the list; hydrate the full transcript only after selection. Fork creates a new ID and parent reference without modifying the source session.

- [ ] **Step 4: Run session index, persistence, and REPL resume tests**

Run: `bun test services/tovyr/sessions services/tovyr/agent/persistence.test.ts commands/resume commands/session`

Expected: zero failures; interrupted run state survives resume and source survives fork.

- [ ] **Step 5: Commit session workflows**

```powershell
git add -- services/tovyr/sessions components/tovyr/TovyrSessionPicker.tsx commands/resume/index.ts commands/session/index.ts screens/REPL.tsx
git commit -m "feat: make Tovyr sessions searchable and resumable"
```

### Task 15: Expose inspectable memory and skill provenance

**Files:**
- Create: `services/tovyr/knowledge/catalog.ts`
- Create: `services/tovyr/knowledge/catalog.test.ts`
- Create: `components/tovyr/TovyrKnowledgePanel.tsx`
- Create: `components/tovyr/TovyrKnowledgePanel.test.tsx`
- Modify: `commands/memory/index.ts`
- Modify: `commands/skills/index.ts`
- Modify: `components/tovyr/TovyrFocusSurface.tsx`

**Interfaces:**
- Produces: `listKnowledge(cwd): Promise<KnowledgeItem[]>` with scope, source, provenance, timestamps, and edit/delete capability flags.

- [ ] **Step 1: Write failing provenance and secret-exclusion tests**

```ts
test('catalog labels project instructions separately from learned memory', async () => {
  const items = await listKnowledge(repo)
  expect(items.find(item => item.path.endsWith('tovyr.md'))?.kind).toBe('project-instructions')
  expect(items.find(item => item.kind === 'learned-memory')?.provenance).toBeTruthy()
})

test('never catalogs credential files as memory', async () => {
  expect((await listKnowledge(repo)).some(item => /credentials|\.env/i.test(item.path))).toBe(false)
})
```

- [ ] **Step 2: Run and confirm the catalog is missing**

Run: `bun test services/tovyr/knowledge/catalog.test.ts`

Expected: FAIL because `catalog.ts` does not exist.

- [ ] **Step 3: Implement adapters over existing memory and skill registries**

```ts
export type KnowledgeItem = {
  id: string
  kind: 'project-instructions' | 'user-preference' | 'session-summary' | 'learned-memory' | 'skill'
  scope: 'project' | 'global'
  title: string
  path: string
  provenance: string
  updatedAt: number
  editable: boolean
  deletable: boolean
}
```

Use `scanMemoryFiles`, `getAllSkills`, and project instruction paths; deny credential/secret paths before reading content. The panel shows metadata first and opens content only on selection.

- [ ] **Step 4: Run knowledge, memory, skill, and focus-surface tests**

Run: `bun test services/tovyr/knowledge services/SessionMemory skills components/tovyr/TovyrKnowledgePanel.test.tsx`

Expected: zero failures; provenance and scope are visible without exposing secrets.

- [ ] **Step 5: Commit the knowledge surface**

```powershell
git add -- services/tovyr/knowledge components/tovyr/TovyrKnowledgePanel.tsx commands/memory/index.ts commands/skills/index.ts components/tovyr/TovyrFocusSurface.tsx
git commit -m "feat: expose Tovyr memory and skill provenance"
```

## Release Gate 6 — Provider and Model Reliability

### Task 16: Finish readiness, transactional activation, and recovery UI

**Files:**
- Modify: `services/tovyr/modelReadiness.ts`
- Modify: `services/tovyr/activateProviderModel.ts`
- Modify: `services/tovyr/providerModels.ts`
- Modify: `services/tovyr/providerFailover.ts`
- Modify: `components/tovyr/TovyrProviderModelPicker.tsx`
- Create: `components/tovyr/TovyrProviderModelPicker.test.tsx`
- Modify: `components/tovyr/TovyrModelSelector.tsx`
- Modify: `components/tovyr/TovyrContextRail.tsx`
- Test: corresponding existing test files

**Interfaces:**
- Consumes: connected provider, verified live catalog, credentials, probes, and opt-in failover flag.
- Produces: atomic activation, retained previous selection on failure, and visible readiness dimensions.

- [ ] **Step 1: Add failing rollback and active-provider-only tests**

```ts
test('failed activation preserves provider, model, env, and AppState', async () => {
  const result = await activateProviderModel(failingInput, deps)
  expect(result.ok).toBe(false)
  expect(readPersistedSelection()).toEqual(previous)
  expect(readAppStateSelection()).toEqual(previous)
})

test('/model rows contain only the active provider catalog', async () => {
  expect((await pickerRows(activeProvider)).every(row => row.providerId === activeProvider)).toBe(true)
})
```

- [ ] **Step 2: Run provider/model tests and identify incomplete behavior**

Run: `bun test services/tovyr/activateProviderModel.test.ts services/tovyr/providerModels.test.ts services/tovyr/modelReadiness.test.ts components/tovyr/TovyrProviderModelPicker.test.tsx`

Expected: new rollback or filtering assertion fails before implementation.

- [ ] **Step 3: Complete atomic activation and readiness projection**

```ts
export type ModelReadiness = {
  credentials: 'ready' | 'missing' | 'not-required'
  catalog: 'ready' | 'stale' | 'missing'
  endpoint: 'reachable' | 'unreachable' | 'unknown'
  compatibility: 'supported' | 'unsupported' | 'unknown'
  lastSuccessAt?: number
}
```

Probe before persistence, update disk/env/AppState as one successful transaction, and return actionable recovery on failure. Show failover state only when `TOVYR_AUTO_FAILOVER=1` actually changes the provider/model.

- [ ] **Step 4: Run all provider/model/auth tests and source help**

Run: `bun test services/tovyr/provider* services/tovyr/model* services/tovyr/activateProviderModel.test.ts commands/tovyr components/tovyr && bun run entrypoints/cli.tsx --help`

Expected: zero test failures; help shows `/model`, API-key authentication, and no automatic failover claim.

- [ ] **Step 5: Commit provider reliability**

```powershell
git add -- services/tovyr/modelReadiness.ts services/tovyr/activateProviderModel.ts services/tovyr/providerModels.ts services/tovyr/providerFailover.ts components/tovyr/TovyrProviderModelPicker.tsx components/tovyr/TovyrModelSelector.tsx components/tovyr/TovyrContextRail.tsx
git commit -m "fix: make Tovyr model activation recoverable"
```

## Release Gate 7 — Human Trials and Release Quality

### Task 17: Build a deterministic source-CLI scenario harness

**Files:**
- Create: `test-support/tovyrScenario.ts`
- Create: `test-support/tovyrScenario.test.ts`
- Create: `test-support/mockProvider.ts`
- Create: `scripts/tovyr-human-trial.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: disposable git project creation, mock provider stream fixtures, source CLI spawning, input scripting, output capture, and cleanup.

- [ ] **Step 1: Write a failing end-to-end coding scenario**

```ts
test('source CLI edits, tests, reports evidence, and resumes', async () => {
  const scenario = await createTovyrScenario()
  const first = await scenario.run(['make add return the sum', '/exit'])
  expect(await scenario.read('src/add.ts')).toContain('a + b')
  expect(first.output).toContain('bun test')
  const resumed = await scenario.resume()
  expect(resumed.output).toContain(first.sessionId)
})
```

- [ ] **Step 2: Run and confirm the harness is missing**

Run: `bun test test-support/tovyrScenario.test.ts`

Expected: FAIL because the scenario runner does not exist.

- [ ] **Step 3: Implement isolated source spawning and scripted mock streams**

```ts
const child = Bun.spawn({
  cmd: ['bun', 'run', SOURCE_ENTRY],
  cwd: projectDir,
  env: { ...SAFE_ENV, TOVYR_FORCE_INTERACTIVE: '1', TOVYR_TEST_PROVIDER_URL: mock.url },
  stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
})
```

Create the project beneath a unique temporary directory, initialize git, use fake credentials only, enforce a 30-second per-step timeout, terminate children in `finally`, and remove only the verified temporary root.

- [ ] **Step 4: Run offline scenarios for Ask, Plan/Code, direct build, failure repair, permission denial, interrupt, resize, `NO_COLOR`, checkpoint restore, and session resume**

Run: `bun test test-support/tovyrScenario.test.ts && bun run trial:tovyr -- --offline`

Expected: every scenario exits zero and prints a per-scenario evidence summary.

- [ ] **Step 5: Commit the scenario harness**

```powershell
git add -- test-support/tovyrScenario.ts test-support/tovyrScenario.test.ts test-support/mockProvider.ts scripts/tovyr-human-trial.ts package.json
git commit -m "test: exercise Tovyr like a developer"
```

### Task 18: Finish accessibility, docs, packaging checks, and defect report

**Files:**
- Modify: `docs/GUIDE.md`
- Create: `docs/GUIDE.test.ts`
- Modify: `README.md`
- Modify: `README.npm.md`
- Create: `docs/audits/2026-08-24-tovyr-workbench-human-trial.md`
- Create: `components/tovyr/TovyrTerminalFallback.test.tsx`

**Interfaces:**
- Consumes: completed gates and scenario evidence.
- Produces: current developer documentation, verified npm dry-run contents, and candid remaining-defect report.

- [ ] **Step 1: Add failing documentation and terminal-capability contracts**

```ts
test('guide documents implemented workbench shortcuts only', () => {
  const guide = readFileSync('docs/GUIDE.md', 'utf8')
  for (const shortcut of implementedShortcuts()) expect(guide).toContain(shortcut.display)
  expect(guide).not.toContain('/models')
})

test.each([{ columns: 36, env: { NO_COLOR: '1' } }, { columns: 60, env: { TERM: 'dumb' } }])('renders operable fallback %#', async options => {
  const result = await renderWorkbench(options)
  expect(result.lastFrame).toContain('mode:')
  expect(result.lastFrame).not.toMatch(/\u001b\[/)
})
```

- [ ] **Step 2: Run docs/capability tests and record all failures**

Run: `bun test docs components/tovyr`

Expected: new docs/fallback assertions fail until copy and fallbacks match reality.

- [ ] **Step 3: Update docs and write the evidence-based trial report**

The report must contain these exact sections:

```markdown
## Environment
## Scenarios Run
## What Worked
## Defects Found and Fixed
## Remaining Defects
## Commands and Exit Codes
## Packaging Contents
## Recommended Next Work
```

Document source launch, commands, modes, permission semantics, session workflows, memory/skills provenance, provider recovery, checkpoints, and every real shortcut. Do not document planned-but-unimplemented functionality.

- [ ] **Step 4: Run fresh complete verification**

Run in order:

```powershell
bun run check:tovyr
bun run trial:tovyr -- --offline
bun run build:runtime
bun run publish:npm:dry-run
git diff --check
git status --short
```

Expected: the first four commands and `git diff --check` exit zero. `git status --short` may remain dirty only for user-owned pre-existing work and the deliberate implementation changes not yet committed; record the exact state in the report.

If already configured credentials are available, additionally run one harmless live source-CLI Ask scenario and one disposable-project Code scenario. Never print or persist credential values.

- [ ] **Step 5: Commit documentation and verified fixes**

```powershell
git add -- docs/GUIDE.md README.md README.npm.md docs/audits/2026-08-24-tovyr-workbench-human-trial.md components/tovyr
git commit -m "docs: report Tovyr workbench human trials"
```

## Final Completion Gate

Before claiming the program complete:

1. Re-read `docs/superpowers/specs/2026-08-24-tovyr-workbench-design.md` and map every success criterion to a passing test, a human trial, or an explicitly reported remaining defect.
2. Run `bun run check:tovyr` fresh and record pass/fail counts.
3. Run `bun run trial:tovyr -- --offline` fresh and record every scenario result.
4. Run `bun run build:runtime` and `bun run publish:npm:dry-run` fresh.
5. Run `bun run check:dead-ui` and confirm zero baselined dead components.
6. Inspect the final terminal output at 36, 60, 80, and 140 columns, including `NO_COLOR=1` and `TERM=dumb`.
7. Inspect `git diff --check`, `git diff --stat`, and `git status --short` without discarding unrelated user changes.
8. Report exact evidence, unresolved issues, and recovery/undo instructions. Do not describe the UI as polished unless the render and human-use evidence supports it.
