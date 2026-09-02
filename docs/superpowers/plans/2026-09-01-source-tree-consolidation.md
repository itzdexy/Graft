# Tovyr Source-Tree Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Consolidate Tovyr's live application code under `src/`, remove the Chrome extension and proven dead/generated material, and keep the supported CLI buildable.

**Architecture:** Repository infrastructure remains at the root while the Bun/TypeScript application and co-located unit tests move as one dependency-preserving tree beneath `src/`. Cleanup is evidence-based: extension-only code and obvious local artifacts are removed directly, while generic placeholder subsystems are deleted only after reference checks show that no build, runtime, package, test, or documentation consumer depends on them.

**Tech Stack:** Bun, TypeScript, React/Ink, Node.js launchers, PowerShell/Bash launch scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-01-source-tree-consolidation-design.md`

## Global Constraints

- Preserve Tovyr's Bun/source-only runtime; do not launch or add `tovyr.exe`.
- Preserve existing uncommitted user changes and do not reformat unrelated files.
- Keep `assets/`, `bin/`, `docs/`, `mcps/`, `packages/`, `scripts/`, and `vendor/` at the repository root.
- Remove `chrome-extension/` and extension-only commands, onboarding, native-host setup, and UI surfaces.
- Keep `/init` creating `tovyr.md`, `/model` singular, and the current provider-specific model filtering.
- Never add, expose, commit, or publish credentials.
- Do not claim that this directory migration guarantees protection from a copyright or DMCA claim.

---

### Task 1: Add a repository-layout regression check

**Files:**
- Create: `scripts/check-source-layout.js`
- Create: `scripts/check-source-layout.test.js`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: repository root resolved from `import.meta.url`.
- Produces: a zero-exit `node scripts/check-source-layout.js` check and a `check:layout` package script.

- [x] **Step 1: Write the failing test**

Create fixture directories in a temporary directory and invoke an exported
`findLayoutViolations(root)` function. Assert that it reports a root-level
`commands/`, a `chrome-extension/`, and known artifact names, while accepting
`src/commands/`, `scripts/`, and `assets/`.

```js
test('reports legacy source roots, chrome extension, and artifacts', () => {
  const violations = findLayoutViolations(fixtureRoot)
  expect(violations).toContain('commands/')
  expect(violations).toContain('chrome-extension/')
  expect(violations).toContain('status.txt')
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `bun test scripts/check-source-layout.test.js`

Expected: FAIL because `check-source-layout.js` does not exist.

- [x] **Step 3: Implement the check**

Export `findLayoutViolations(root)` and guard CLI execution with an
`import.meta.url` comparison. The forbidden directory set must contain the
retained source directories listed in Task 4 plus `chrome-extension`; the
artifact matchers must cover `*.log`, `*.bak`, root test-output `*.txt`, packed
`*.tgz`, `nul`, `.tovyr-review-build`, and `.tovyr-test-build`.

The CLI prints each violation and exits 1, or prints
`Tovyr source layout is clean.` and exits 0.

- [x] **Step 4: Wire the check into package scripts and CI**

Add:

```json
"check:layout": "node scripts/check-source-layout.js"
```

Run it in CI immediately after `check:brand`.

- [x] **Step 5: Verify the focused test**

Run: `bun test scripts/check-source-layout.test.js`

Expected: PASS.

### Task 2: Remove Chrome-extension product surfaces

**Files:**
- Delete: `chrome-extension/**`
- Delete: extension-only command/component/hook/utility files identified by exact reference tracing
- Modify: command registration, help, docs, scripts, and package metadata that refer to Chrome-extension setup
- Test: affected command, tool, and brand tests under the retained source tree

**Interfaces:**
- Consumes: current command registry and browser/web tooling boundaries.
- Produces: no `chrome-extension/` tree and no reachable extension-only UI, native-host, setup, or launcher code.

- [x] **Step 1: Record all extension references**

Run:

```powershell
rg -n -i --glob '!node_modules/**' 'chrome-extension|claude in chrome|chrome native host|setupChrome|tovyrExtension'
```

Classify each result as extension-only, shared browser automation, historical
documentation, or third-party compatibility. Do not remove local browser/web
capabilities merely because they use Chromium or CDP.

- [x] **Step 2: Remove extension-only registrations and tests first**

Delete registrations for extension onboarding/setup and remove their dedicated
tests. Run the closest command and tool tests and expect failures that identify
remaining imports.

- [x] **Step 3: Delete extension-only modules and the extension tree**

Delete `chrome-extension/` and the modules whose only consumers were removed in
Step 2. Remove extension-only vendor shims only when no other import remains.

- [x] **Step 4: Remove user-facing extension claims**

Update README, guide, help, and diagnostics copy so Tovyr does not advertise an
extension, native host, or extension onboarding path that no longer exists.

- [x] **Step 5: Verify absence and shared browser behavior**

Run:

```powershell
rg -n -i --glob '!node_modules/**' 'chrome-extension|claude in chrome|chrome native host|setupChrome|tovyrExtension'
bun test services/tovyr/browser tools/TovyrWebTool
```

Expected: no active extension references; independent browser/web tests pass.

### Task 3: Remove generated artifacts and unused placeholder subsystems

**Files:**
- Delete: `_tovyr-test-out.txt`, `.package.dev.json.bak`, `.README.dev.md.bak`, `.tovyr-gateway.err.log`, `.tovyr-gateway.out.log`, `.tovyr-test-err.txt`, `.tovyr-test-out.txt`, `errs.txt`, `filelist.txt`, `lsfiles.txt`, `nul`, `status.txt`, `tovyr-test-errors.txt`, `tovyr-test-results.txt`, `tovyrcode-1.2.0.tgz`
- Delete when unreferenced: `actors/`, `adversary/`, `analytics/`, `architecture/`, `automations/`, `autonomous/`, `backend/`, `cache/`, `cicd/`, `cloning/`, `collaboration/`, `comments/`, `crew/`, `debugging/`, `events/`, `graph/`, `guardrails/`, `local/`, `multimodality/`, `multimodel/`, `observability/`, `parallel/`, `performance/`, `pipelines/`, `quantization/`, `recipes/`, `scaffolding/`, `scoring/`, `sdk/`, `security/`, `sessions/`, `syntax/`, `testing/`, `theory/`, `updates/`, `validation/`, `vector/`, `workflow/`, `workflows/`
- Delete when unreferenced: `Cargo.toml`, `main.rs`, `src/main.rs`, `index.html`, `index.ts`, `tovyr.cmd`
- Modify: `.gitignore`, `.npmignore`, documentation links found during tracing

**Interfaces:**
- Consumes: import references, package scripts/exports/files, CI configuration, and documentation links.
- Produces: removal manifest containing only files with no verified consumer.

- [x] **Step 1: Prove each candidate is unreferenced**

For each candidate, search imports, dynamic imports, filesystem string paths,
package metadata, shell scripts, CI, and docs. Retain and move any candidate
with a real consumer; do not delete it based on its name or writing style.

- [x] **Step 2: Delete obvious local artifacts**

Resolve every target to an absolute path beneath the repository before deleting
it. Add narrow ignore patterns for repeatable output artifacts.

- [x] **Step 3: Delete proven placeholder subsystems**

Remove only candidates with zero verified consumers. Record retained exceptions
in the implementation summary with their consumer.

- [x] **Step 4: Verify package and documentation references**

Run `npm pack --dry-run --json` and search for deleted paths across tracked and
untracked non-ignored files. Expected: no package input or maintained document
depends on a deleted path.

### Task 4: Move retained application code beneath `src/`

**Files:**
- Move: root runtime directories to matching `src/<directory>/` paths
- Move: root application modules `commands.ts`, `context.ts`, `cost-tracker.ts`, `costHook.ts`, `dialogLaunchers.tsx`, `history.ts`, `ink.ts`, `interactiveHelpers.tsx`, `main.tsx`, `projectOnboardingState.ts`, `query.ts`, `QueryEngine.ts`, `replLauncher.tsx`, `setup.ts`, `Task.ts`, `tasks.ts`, `Tool.ts`, `tools.ts`, and `tools.test.ts` to `src/`
- Move: `fixtures/` to `tests/fixtures/` unless runtime tracing identifies a production consumer
- Move: `test-support/` to `src/test/`
- Modify: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.tovyr.json`, `tsconfig.typecheck.json`, `bunfig.toml`, `biome.json`
- Modify: `package.json`, `package.npm.json`, `.github/workflows/ci.yml`, `Dockerfile`
- Modify: `bin/**`, `scripts/**`, docs, and source string paths that resolve old locations

**Interfaces:**
- Consumes: existing ESM relative imports and `src/*` alias imports.
- Produces: CLI entrypoint at `src/entrypoints/cli.tsx` and alias mapping `src/* -> ./src/*`.

- [x] **Step 1: Capture a pre-move validation baseline**

Run the focused version commands, `npm run typecheck`, and a representative
test subset. Save results outside the repository so migration failures can be
distinguished from pre-existing failures.

- [x] **Step 2: Move complete dependency neighborhoods**

Move each retained directory as a whole so internal relative imports continue
to resolve. Merge into the existing `src/` only after moving or deleting its
current Rust `main.rs` according to Task 3.

- [x] **Step 3: Update configuration roots**

Set:

```json
"paths": { "src/*": ["./src/*"] },
"include": ["src/**/*.ts", "src/**/*.tsx"]
```

Update explicit file lists to `src/...`; set Bun's alias to `./src/`; point
preloads to `./src/build/preload.ts` and `./src/build/test-preload.ts`.

- [x] **Step 4: Update launch and build paths**

Every launcher and runtime builder must resolve `src/entrypoints/cli.tsx`.
Update error messages that name the old path. Keep launcher `cwd` behavior
unchanged so Bun loads root `bunfig.toml` before the CLI restores the user's
invocation directory.

- [x] **Step 5: Repair explicit path strings**

Search source, scripts, CI, Docker, package metadata, and maintained docs for
old root paths. Update only paths affected by the move; do not rewrite unrelated
language or behavior.

- [x] **Step 6: Run migration-focused validation**

Run:

```powershell
bun run src/entrypoints/cli.tsx --version
node bin/tovyr.js --version
npm run build:runtime
npm run typecheck
bun test scripts/check-source-layout.test.js
```

Expected: launcher/build paths resolve beneath `src/`; any remaining failures
match the recorded baseline or are fixed before continuing.

### Task 5: Add accurate provenance and update contributor navigation

**Files:**
- Create: `NOTICE`
- Modify: `README.md`
- Modify: `README.npm.md`
- Modify: `AGENTS.md`
- Modify: `docs/GUIDE.md`
- Modify: `.gitignore`, `.npmignore`

**Interfaces:**
- Consumes: final retained repository shape and existing licensing statements.
- Produces: concise project map, artifact policy, and non-misleading provenance notice.

- [x] **Step 1: Write the provenance notice**

State only confirmed facts: Tovyr is independently branded and maintained;
third-party components remain governed by their own notices; restructuring does
not change ownership or licensing; questions about legal status require legal
review. Do not claim clean-room development unless documented evidence exists.

- [x] **Step 2: Update repository maps and commands**

Change source paths to `src/...`, remove Chrome-extension instructions, and
document `npm run check:layout`. Keep supported Tovyr behavior descriptions
unchanged.

- [x] **Step 3: Verify naming and stale paths**

Run:

```powershell
npm run check:brand
npm run check:layout
rg -n --glob '!node_modules/**' 'chrome-extension|entrypoints/cli\.tsx|services/tovyr|components/tovyr'
```

Expected: path mentions use `src/...`; no active Chrome-extension claims remain.

### Task 6: Full validation and migration report

**Files:**
- Modify only migration-caused failures found by validation
- Update: this plan's checkboxes as tasks complete

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: verified source-tree migration and a concise list of pre-existing failures, if any.

- [x] **Step 1: Run static and layout checks**

```powershell
npm run check:brand
npm run check:layout
npm run check:dead-ui
npm run typecheck
```

- [x] **Step 2: Run tests and runtime build**

```powershell
npm test
npm run build:runtime
```

- [x] **Step 3: Run launcher and package smoke checks**

```powershell
bun run src/entrypoints/cli.tsx --version
node bin/tovyr.js --version
npm run publish:npm:dry-run
```

- [x] **Step 4: Inspect final Git state**

Confirm that deletions and moves are limited to the approved scope, no secret
files are staged, and unrelated pre-existing modifications remain intact.

- [x] **Step 5: Report results**

Summarize the final root shape, removed subsystems/artifacts, retained exceptions,
configuration changes, and the exact pass/fail result of every validation command.
