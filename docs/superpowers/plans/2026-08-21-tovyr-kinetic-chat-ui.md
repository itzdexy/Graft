# Tovyr Kinetic Chat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved chat-first terminal UI with one truthful animated activity surface, real web-search stages, quiet completed history, and accessible static fallbacks.

**Architecture:** Introduce a pure turn-activity view model between runtime events and Ink rendering. `TovyrChatDock` remains the integration point, while a focused `TovyrActivitySurface` owns all live thinking, search, tool, permission, recovery, and verification presentation so legacy components cannot duplicate spinners.

**Tech Stack:** React 19, Ink 7, TypeScript, Bun test, existing Tovyr design tokens

**Spec:** `docs/superpowers/specs/2026-08-21-tovyr-chat-model-orchestration-design.md`

## Global Constraints

- Normal chat remains single-column and shows no orchestration chrome.
- Exactly one top-level live activity surface may render per turn.
- Animation represents real runtime state and never fabricates sources, files, progress, or percentages.
- Finished work collapses into a static evidence line.
- No robot, sparkle, glowing-orb, or generic AI iconography.
- `NO_COLOR`, `TERM=dumb`, `CI`, reduced-motion, and narrow terminals receive complete static text.
- Active mode remains in the prompt footer bottom-right.
- Use existing theme tokens; do not introduce hard-coded product gradients in terminal components.

## File Structure

- Create `services/tovyr/dx/turnActivity.ts`: activity event/state reducer and evidence collapse.
- Create `services/tovyr/dx/turnActivity.test.ts`: deterministic state-priority tests.
- Create `components/tovyr/TovyrActivitySurface.tsx`: sole live renderer.
- Create `components/tovyr/TovyrActivitySurface.test.ts`: pure presentation projection tests.
- Modify `components/tovyr/TovyrChatDock.tsx`: adapt current props to the activity view model.
- Modify `components/tovyr/TovyrLiveActivity.tsx`: remove or reduce to a compatibility adapter, then delete after callers migrate.
- Modify thinking/tool/status message components to suppress active-turn duplicates.
- Modify design tokens and terminal layout tests for narrow/reduced-motion behavior.

---

### Task 1: Pure turn-activity state model

**Files:**
- Create: `services/tovyr/dx/turnActivity.ts`
- Create: `services/tovyr/dx/turnActivity.test.ts`

**Interfaces:**
- Produces: `TovyrActivityKind`, `TovyrActivityEvidence`, `TovyrTurnActivity`, `reduceTurnActivity`, and `completeTurnActivity`.

- [ ] **Step 1: Write failing reducer priority tests**

```ts
expect(reduceTurnActivity(null, { type: 'thinking', label: 'Inspecting', at: 1 })?.kind).toBe('thinking')
expect(reduceTurnActivity(thinking, { type: 'tool_started', toolName: 'Bash', summary: 'bun test', at: 2 })?.kind).toBe('running_tool')
expect(reduceTurnActivity(tooling, { type: 'permission_requested', summary: 'Run bun test', at: 3 })?.kind).toBe('waiting_for_permission')
expect(completeTurnActivity(activity, 4).status).toBe('complete')
```

Add a test proving only one `kind` exists while prior concrete events move into `evidence`.

- [ ] **Step 2: Run the missing-module test**

Run: `bun test services/tovyr/dx/turnActivity.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the view-model types and reducer**

```ts
export type TovyrActivityKind =
  | 'thinking' | 'searching' | 'reading_source' | 'running_tool'
  | 'waiting_for_permission' | 'handoff' | 'verifying'
  | 'recovering' | 'failed' | 'complete'

export type TovyrTurnActivity = {
  kind: TovyrActivityKind
  status: 'active' | 'failed' | 'complete'
  label: string
  startedAt: number
  updatedAt: number
  evidence: Array<{ key: string; label: string; detail?: string; state: 'active' | 'done' | 'failed' }>
  detail?: string
}
```

Priority while active: permission > failed/recovering > tool > search/read > handoff/verify > thinking. Evidence keys deduplicate repeated updates.

- [ ] **Step 4: Run reducer tests**

Run: `bun test services/tovyr/dx/turnActivity.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the activity model**

Commit the two task files with message `feat: model Tovyr turn activity`.

### Task 2: Runtime-to-activity adapter

**Files:**
- Create: `services/tovyr/dx/activityAdapter.ts`
- Create: `services/tovyr/dx/activityAdapter.test.ts`
- Modify: `components/tovyr/TovyrChatDock.tsx`

**Interfaces:**
- Consumes: current chat dock props, stream mode, tool IDs, streaming tool uses, permission state, and TovyrWeb tool summaries.
- Produces: `deriveTurnActivity(input: ActivityAdapterInput): TovyrTurnActivity | null`.

- [ ] **Step 1: Add failing derivation tests**

Cover: thinking-only, TovyrWeb search, TovyrWeb source read, Bash tool, permission wait, response streaming suppression, and idle. Assert a search with three actual results says `3 results`; no result count yields no invented number.

- [ ] **Step 2: Run adapter tests**

Run: `bun test services/tovyr/dx/activityAdapter.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement deterministic derivation**

The adapter uses existing `formatOpenCodeToolLine` and TovyrWeb tool input/result markers. It never parses free-form assistant prose to invent state. It returns `null` when streaming assistant text is already visible in the transcript and no concrete tool/search/permission activity exists.

- [ ] **Step 4: Run adapter plus existing activity tests**

Run: `bun test services/tovyr/dx/activityAdapter.test.ts services/tovyr/dx/activityDisplay.test.ts services/tovyr/dx/waitStateCopy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the adapter**

Commit task files with message `feat: derive one live chat activity`.

### Task 3: Kinetic activity renderer with static fallback

**Files:**
- Create: `components/tovyr/TovyrActivitySurface.tsx`
- Create: `components/tovyr/TovyrActivitySurface.test.ts`
- Modify: `components/design-system/themeTokens.ts`
- Modify: `components/design-system/spacing.ts`

**Interfaces:**
- Consumes: `TovyrTurnActivity`, terminal width, elapsed time, and reduced-motion/color capability.
- Produces: one Ink surface and `projectActivityLines(...)` for deterministic tests.

- [ ] **Step 1: Write failing presentation projection tests**

```ts
const lines = projectActivityLines(searchingActivity, { width: 80, reducedMotion: true })
expect(lines[0]).toContain('Searching')
expect(lines.join('\n')).toContain('3 results')
expect(lines.join('\n')).not.toMatch(/[⠋⠙⠹]/)
expect(projectActivityLines(searchingActivity, { width: 34, reducedMotion: true }).every(line => stringWidth(line) <= 34)).toBe(true)
```

- [ ] **Step 2: Run the missing-component test**

Run: `bun test components/tovyr/TovyrActivitySurface.test.ts`

Expected: FAIL because the component/projection does not exist.

- [ ] **Step 3: Implement restrained state motion**

Use a small token-driven pulse/scanning sequence for active states, elapsed time, and textual prefixes. Reduced motion uses a static `>` marker. Use `tovyrPrimary`, `text`, `subtle`, `success`, `warning`, and `error`; do not add raw hex colors.

Render at most one headline plus three evidence rows. Additional evidence collapses to `+N more` and remains available in completed transcript details.

- [ ] **Step 4: Run renderer, spacing, and terminal layout tests**

Run: `bun test components/tovyr/TovyrActivitySurface.test.ts components/design-system/spacing.test.ts services/tovyr/terminalLayout.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the renderer**

Commit task files with message `feat: render kinetic Tovyr activity`.

### Task 4: Replace duplicate live indicators in chat

**Files:**
- Modify: `components/tovyr/TovyrChatDock.tsx`
- Modify: `components/tovyr/TovyrLiveActivity.tsx`
- Modify: `components/tovyr/TovyrSpinnerStatusRow.tsx`
- Modify: `components/messages/AssistantThinkingMessage.tsx`
- Modify: `components/messages/AssistantToolUseMessage.tsx`
- Modify: `components/Messages.tsx`
- Test: `services/tovyr/launcherStartupContract.test.ts`

**Interfaces:**
- Consumes: activity adapter and renderer from Tasks 2–3.
- Produces: a single `TovyrActivitySurface` above the composer; completed history remains rendered by message components.

- [ ] **Step 1: Add failing source-contract tests**

Extend the startup contract to assert Tovyr chat imports `TovyrActivitySurface`, does not render `TovyrSpinnerStatusRow` from more than one active-turn path, and suppresses active thinking/tool animation inside transcript message components.

- [ ] **Step 2: Run the contract test**

Run: `bun test services/tovyr/launcherStartupContract.test.ts`

Expected: FAIL while old live components remain active.

- [ ] **Step 3: Wire the new surface and retire duplicate paths**

`TovyrChatDock` derives one view model and renders one surface. Transcript thinking/tool components receive or infer `isActiveTurn` and render static completed content only. Keep a temporary compatibility export only if another non-Tovyr runtime imports `TovyrLiveActivity`.

- [ ] **Step 4: Run Tovyr UI and full service tests**

Run: `bun test services/tovyr components/design-system`

Expected: PASS.

- [ ] **Step 5: Commit the single-surface migration**

Commit task files with message `fix: keep one live activity surface`.

### Task 5: Real web-search stages and evidence collapse

**Files:**
- Modify: `tools/TovyrWebTool/TovyrWebTool.ts`
- Modify: `tools/TovyrWebTool/TovyrWebTool.test.ts`
- Modify: `services/tovyr/dx/activityAdapter.ts`
- Modify: `services/tovyr/dx/turnActivity.ts`
- Modify: `services/tovyr/web/contentSelection.ts`
- Test: `services/tovyr/web/contentSelection.test.ts`

**Interfaces:**
- Consumes: actual TovyrWeb search/read result metadata.
- Produces: `searching`, `reading_source`, and completion evidence with query, real result count, and actual source hosts.

- [ ] **Step 1: Add failing web activity metadata tests**

Assert the tool result exposes safe metadata:

```ts
expect(result.activity).toEqual({
  operation: 'search', query: 'NVIDIA NIM models', resultCount: 3,
  sourceHosts: ['docs.nvidia.com', 'build.nvidia.com'],
})
```

Assert snippets and full page content are not copied into activity metadata.

- [ ] **Step 2: Run web tests**

Run: `bun test tools/TovyrWebTool/TovyrWebTool.test.ts services/tovyr/web/contentSelection.test.ts services/tovyr/dx/activityAdapter.test.ts`

Expected: FAIL because safe structured activity metadata is missing.

- [ ] **Step 3: Emit and consume safe metadata**

Derive hostnames from returned URLs, deduplicate them, and cap visible hosts at three. Completion evidence becomes `Searched <query> · N results · host1, host2`; a source read becomes `Read <host> · <page title>`.

- [ ] **Step 4: Run web and activity suites**

Run: `bun test tools/TovyrWebTool/TovyrWebTool.test.ts services/tovyr/web services/tovyr/dx`

Expected: PASS.

- [ ] **Step 5: Commit web activity integration**

Commit task files with message `feat: animate real web search stages`.

### Task 6: Polish header, transcript, composer, and accessibility

**Files:**
- Modify: `components/tovyr/TovyrHeader.tsx`
- Modify: `components/tovyr/TovyrChatDock.tsx`
- Modify: `components/PromptInput/PromptInputFooter.tsx`
- Modify: `components/PromptInput/PromptInputModeIndicator.tsx`
- Modify: `components/tovyr/TovyrModeBadge.tsx`
- Modify: `utils/theme.ts`
- Modify: `docs/GUIDE.md`
- Test: `services/tovyr/modeFooter.test.ts`
- Test: `services/tovyr/terminalLayout.test.ts`

**Interfaces:**
- Consumes: canonical model names and readiness from plans 1–2.
- Produces: approved chat-first hierarchy across wide, narrow, reduced-motion, and colorless terminals.

- [ ] **Step 1: Add failing layout and footer assertions**

Assert mode is bottom-right at wide widths, remains visible at narrow widths, provider/model truncates before mode, header never duplicates provider/model, and colorless output retains state words.

- [ ] **Step 2: Run layout tests**

Run: `bun test services/tovyr/modeFooter.test.ts services/tovyr/terminalLayout.test.ts`

Expected: FAIL on any hierarchy contract not currently represented.

- [ ] **Step 3: Apply the approved hierarchy**

Keep the header identity-only, the transcript quiet, the activity surface directly above the composer, and operational metadata in the footer. Replace hard-coded decorative colors in touched Tovyr components with theme tokens.

- [ ] **Step 4: Run UI tests and source launcher smoke test**

Run: `bun test services/tovyr components/design-system; bun run entrypoints/cli.tsx --help`

Expected: tests PASS; help exits successfully; do not launch `tovyr.exe`.

- [ ] **Step 5: Commit final UI polish**

Commit task files with message `feat: polish Tovyr chat UI`.

