# Task 7 — Resolve baselined dead Tovyr UI

## Scope

Removed the dead-UI exemption list and resolved every one of its twelve
entries through a real workbench projection or deletion. The old welcome stays
superseded by `TovyrWorkspaceDashboard`; the shell now supplies the compact
empty-transcript prompt guidance without changing that dashboard.

## RED

1. Added `scripts/check-dead-ui.test.js` before changing the checker.
   `bun test scripts/check-dead-ui.test.js` failed as expected because
   `BASELINE` still contained the twelve legacy names.
2. Added the empty-transcript shell render case before changing the shell.
   `bun test components/tovyr/TovyrWorkbenchShell.test.tsx` failed as expected:
   it rendered `chat\nprompt` but not the expected `? help` guidance.

## GREEN

| Baselined export | Disposition | Live owner/caller |
| --- | --- | --- |
| `TovyrAgentHud` | Integrated | REPL passes it into the workbench `agents` focus surface when an agent task is being viewed. |
| `TovyrAgentStepProgress` | Integrated | Same agents focus surface, refreshed from the displayed agent transcript. |
| `TovyrCodeAcceptancePanel` | Integrated | The live Tovyr Exit Plan Mode review renders plan evidence through it; the existing sticky permission action row remains the action owner. |
| `TovyrCostMeter` | Integrated | `TovyrContextRail` projects real session totals. |
| `TovyrSessionHeader` | Integrated | `TovyrContextRail` projects actual session/title/token context. |
| `TovyrEmptyState` | Integrated | `TovyrWorkbenchShell` renders compact guidance for a genuinely empty REPL transcript while preserving `TovyrWorkspaceDashboard` as the welcome view. |
| `TovyrFileSidebar` | Integrated | `TovyrFocusSurface` renders it only for the `file` workbench focus, using the real workspace root. |
| `TovyrNotifications` | Integrated | `TovyrContextRail` receives the active Tovyr text notification from REPL and routes dismissals to the established notification owner. |
| `TovyrStatusBar` | Integrated | `TovyrContextRail` receives the current displayed messages/loading state from REPL. |
| `TovyrSpinnerStatusRow` | Deleted | Superseded by the sole live `TovyrActivitySurface`/`TovyrLiveActivity` path; avoids a second spinner row. |
| `TovyrWelcomePanel` | Deleted | Superseded by the mounted `TovyrWorkspaceDashboard`. |
| `warmUpCache` | Deleted | No startup or runtime caller existed; `SmartCacheSystem.warmUp` remains available as the instance operation. |

`scripts/check-dead-ui.js` now has `const BASELINE = new Set([])`, so every
future unreferenced Tovyr component or `warm*` helper is a hard failure rather
than a new exemption.

## Verification

```text
bun test scripts/check-dead-ui.test.js components/tovyr services/tovyr/launcherStartupContract.test.ts
71 pass, 0 fail, 363 expects

bun run check:dead-ui
check-dead-ui: no NEW unreferenced components (0 baselined).

bun run check:tovyr
pass (focused Tovyr suite, type slice, dead-UI, and brand gates)

git diff --cached --check
pass
```

## Risk / follow-up

- The general TypeScript gate intentionally remains the existing focused
  Tovyr-owned slice; it does not typecheck every inherited UI source file.
  The changed rendering paths were exercised by the component/startup suite
  and Bun transpilation in those tests.
- The task touched only its own staged REPL hunks. Pre-existing dirty REPL and
  dashboard work remains unstaged and was not altered or absorbed by this
  commit.

## Commit

`7c81765 refactor: finish Tovyr workbench components`

## Review fix round 1

### Root cause and ruling

The first Task 7 commit deleted `TovyrSpinnerStatusRow` while its committed
`TovyrLiveActivity` caller still imported and rendered it. An uncommitted
activity-surface migration in the shared checkout hid that defect. I reproduced
the broken import from the committed tree in the isolated worktree
`C:\Users\uwuuy\Downloads\tovyr-task7-clean-7c81765` before changing code.

The repair stages the complete live migration together: `TovyrLiveActivity`
derives one truthful turn activity and renders only `TovyrActivitySurface`.
The reducer/adapter/surface and their tests are included in this commit, so the
deleted spinner has no live caller in a clean checkout.

### RED / GREEN evidence

- RED: the isolated `7c81765` tree still imported `./TovyrSpinnerStatusRow.js`;
  that file was deleted by the same commit.
- RED: the new checker fixture contained only an import, a test mention, a
  comment, and a string for `TovyrGhost`; the old substring checker exited 0.
- RED: the new `/files`, empty-transcript, and context-HUD contracts initially
  failed because their helpers and production route did not exist.
- GREEN: the checker ignores test files, imports, comments, and quoted literals
  before matching a production identifier. The textual-only fixture now exits
  1 while the repository has an empty baseline.
- GREEN: `/files` is enabled in Tovyr, appears through the existing command
  index, and REPL resolves that enabled command to `file` focus. The next normal
  submission resolves back to `none`; this is a command route, not a dummy UI
  toggle.
- GREEN: the shell delegates the `agents` focus to its dedicated `TovyrAgentHud`
  and suppresses the context rail's status HUD there. The context rail remains
  the owner outside that focus.
- GREEN: empty guidance now requires zero messages, no pending placeholder,
  no loading/processing, and no active tools.

### Additional dead exports

The hardened checker exposed two older, genuinely unmounted welcome/boot
surfaces. Both were removed rather than exempted: the mounted workspace
dashboard remains the welcome owner and the standard REPL boot path does not
mount the retired boot screen. No dirty user edits to those files were present.

### Verification before commit

```text
bun test components/tovyr/TovyrWorkbenchShell.test.tsx components/tovyr/TovyrContextRail.test.ts services/tovyr/dx/workbenchFocus.test.ts scripts/check-dead-ui.test.js components/tovyr/TovyrLiveActivity.test.tsx components/tovyr/TovyrActivitySurface.test.ts services/tovyr/dx/activityAdapter.test.ts services/tovyr/dx/turnActivity.test.ts
50 pass, 0 fail

bun run check:dead-ui
check-dead-ui: no NEW unreferenced components (0 baselined).

bun run check:tovyr
pass (Tovyr suite, TypeScript slice, dead-UI, and brand gates)

git diff --cached --check
pass
```

The final clean committed-tree verification and commit identifier are recorded
after this report is committed.

## Review fix round 1 completion

### Final disposition ledger

The second clean-tree scan was intentionally not narrowed: it found real UI
exports that were only reachable through unrelated, uncommitted checkout
changes. Each retained export below is now mounted through its actual owner;
no test, comment, import-only reference, or dummy toggle is used as evidence.

| Export | Final disposition | Production route / owner |
| --- | --- | --- |
| `TovyrSpinnerStatusRow` | Deleted | Replaced everywhere by `TovyrLiveActivity` → `TovyrActivitySurface`; there is one activity row. |
| `TovyrWelcomePanel` | Deleted | `TovyrWorkspaceDashboard` remains the sole mounted welcome owner. |
| `warmUpCache` | Deleted | No justified runtime caller; `SmartCacheSystem.warmUp` remains the instance API. |
| `TovyrAssistantTextMessage` | Integrated | `components/Message.tsx` uses it for Tovyr assistant content. |
| `TovyrCollapsedReadSearchGroup` | Integrated | `components/Message.tsx` renders collapsed Tovyr read/search groups. |
| `TovyrTranscriptContext` | Integrated | `components/Messages.tsx` supplies transcript context in the live message projection. |
| `TovyrCommandPalette` | Integrated | `PromptInput` owns the palette; existing `Ctrl+P` / `Ctrl+K` command-palette bindings open it. |
| `TovyrKeyHintBar` | Integrated | `PromptInputFooter` renders the live input hints. |
| `TovyrModelSelector` | Integrated | `PromptInputFooter` opens it through the live Tovyr model badge, using the existing provider/model activation path. |
| `TovyrGitHubUpdateNotice` | Integrated | REPL places it below the existing AWS auth notice. |
| `TovyrSilentTurnNotice` | Integrated | REPL renders it only for a non-agent Tovyr silent turn with no pending user placeholder or active tool. |
| `TovyrBootScreen` | Retained and verified | `main.tsx` mounts it during the real pre-REPL boot transition; it was restored after the clean-tree source contract caught the incorrect deletion. |

The original twelve baselined exports retain the dispositions in the first
ledger above. In particular, `TovyrFileSidebar` is reachable via the enabled
`/files` command through the real command index and REPL focus resolver, and
`TovyrEmptyState` is guarded by an actually idle transcript: no messages, no
pending user placeholder, no load/processing state, and no active tool.

### Repair RED / GREEN sequence

- RED: the clean `7c81765` tree imported the deleted spinner from
  `TovyrLiveActivity`.
- GREEN: `93304eb` migrated that caller to `TovyrActivitySurface` and added
  turn-activity reducer/adaptor coverage.
- RED: a production-only scan of the clean `93304eb` tree found the eight
  unmounted UI exports listed above.
- GREEN: `f2ae8ce` mounted each in its established UI owner and preserved the
  single HUD owner by suppressing the context status HUD in agents focus.
- RED: a clean launcher contract then showed that `TovyrBootScreen` is mounted
  by `main.tsx`, so deleting it was not justified.
- GREEN: `f87ea0d` restored the truthful boot transition, and `83491bd` made
  the checker scan root entry points including `main.tsx`.
- RED: the clean source contract still expected the unfiltered streaming
  variable after the live Tovyr transcript filter was integrated.
- GREEN: this final test adjustment asserts `displayStreamingText` and the
  live dock's `streamingTextPreview` / `suppressIdleStatus` contract.

### Clean committed-tree verification

The final verification uses a fresh detached worktree at the final commit,
with only a `node_modules` junction to the existing workspace dependency tree;
no source, credentials, or ignored configuration is copied from the dirty
checkout.

```text
bun test scripts/check-dead-ui.test.js components/tovyr/TovyrCommandDiscovery.render.test.tsx components/tovyr/TovyrWorkbenchShell.test.tsx components/tovyr/TovyrContextRail.test.ts components/tovyr/TovyrLiveActivity.test.tsx components/tovyr/TovyrActivitySurface.test.ts services/tovyr/dx/workbenchFocus.test.ts services/tovyr/dx/activityAdapter.test.ts services/tovyr/dx/turnActivity.test.ts services/tovyr/launcherStartupContract.test.ts
68 pass, 0 fail

node scripts/check-dead-ui.js
check-dead-ui: no NEW unreferenced components (0 baselined).

.\\node_modules\\.bin\\tsc.cmd -p tsconfig.tovyr.json
pass
```

The final clean-worktree run is repeated after the report/test commit so the
command count and commit tree are the final state rather than the dirty overlay.

That repeat initially caught one last dirty-overlay leak: the assertion had
been committed but `TovyrChatDock` still passed `null` for
`streamingTextPreview` and folded its stream state into `suppressIdleStatus`.
The follow-up commit stages only those two live props (not the unrelated dirty
orchestration work in that component), then repeats this clean-tree command.

### Remaining risk

`check:tovyr` is present only in the user's uncommitted `package.json` overlay,
so a detached committed tree cannot invoke that npm script by name. Its direct
equivalents above (focused Tovyr tests, dead-UI gate, and Tovyr TypeScript
slice) are run in the clean tree. The shared checkout's `bun run check:tovyr`
is also run after the final commit. The baseline remains literally empty.
