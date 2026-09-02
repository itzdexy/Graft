# Tovyr Application Manager Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one tested application-manager layer that reports and launches Tovyr integrations honestly for Codex, ChatGPT, Claude, and every requested external client.

**Architecture:** Keep provider/model routing in the existing loopback gateway. Add small Node-compatible application-manager modules beneath `scripts/tovyr-apps/`; the current lightweight launcher delegates to them. Each manifest declares an integration kind and readiness state so routing, tool-only, and manual integrations are never conflated.

**Tech Stack:** Bun tests, Node-compatible ESM launchers, existing Tovyr provider state, TypeScript gateway, Windows PowerShell discovery.

**Spec:** `docs/superpowers/specs/2026-08-27-tovyr-application-adapters-design.md`

## Global Constraints

- Use only the Bun/source Tovyr CLI; never create or launch `tovyr.exe`.
- Preserve the dirty working tree; do not reset, checkout, or commit unrelated user changes.
- Do not write provider API keys or third-party credentials into application config files.
- Keep the gateway loopback-only by default and redact generated gateway tokens.
- Advertise a client as `ready` only after its discovered launch/config route has focused tests.
- Treat Claude Desktop and ChatGPT Chat/Work as tool-only; model routing is limited to Claude Code and ChatGPT's Codex view.
- Keep `tovyr`, `/model`, `/init`, `/plan`, `/code`, and Windows PowerShell launch behavior unchanged.

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/tovyr-apps/catalog.js` | Immutable adapter manifests and client capability metadata. |
| `scripts/tovyr-apps/catalog.test.js` | Catalog completeness and no-false-readiness tests. |
| `scripts/tovyr-apps/discovery.js` | Platform-safe executable/AppX discovery and status computation. |
| `scripts/tovyr-apps/discovery.test.js` | Fixture-driven Windows, PATH, manual, and tool-only discovery tests. |
| `scripts/tovyr-apps/managed-state.js` | Owner-only connection manifests, gateway process records, and backups. |
| `scripts/tovyr-apps/managed-state.test.js` | Isolated-home persistence, redaction, and safe cleanup tests. |
| `scripts/tovyr-apps/operations.js` | List, status, configure, launch, disconnect, restore, and doctor operations. |
| `scripts/tovyr-apps/operations.test.js` | Operation contracts with injected adapters, filesystem, and launcher fakes. |
| `scripts/tovyr-app-cli.js` | Thin argument parser and compatibility aliases delegating to operations. |
| `scripts/tovyr-app-cli.test.js` | CLI parsing, legacy alias, and user-facing output regressions. |
| `scripts/tovyr-cli-ux.js` | Main help entries for the complete `apps` command surface. |
| `docs/GUIDE.md` | Supported-client matrix, model-routing boundary, and recovery commands. |

## Task 1: Define the adapter catalog

**Files:**
- Create: `scripts/tovyr-apps/catalog.js`
- Create: `scripts/tovyr-apps/catalog.test.js`

**Interfaces:**
- Produces `APP_IDS`, `APP_INTEGRATION_KINDS`, `APP_READINESS`, `listAppAdapters()`, and `getAppAdapter(id)`.
- Consumed by discovery and operations. `getAppAdapter()` returns `null` for unknown IDs and never throws.

- [ ] **Step 1: Write the failing catalog tests**

```js
import { describe, expect, test } from 'bun:test'
import { getAppAdapter, listAppAdapters } from './catalog.js'

test('lists every requested client exactly once', () => {
  expect(listAppAdapters().map(app => app.id)).toEqual([
    'codex', 'chatgpt', 'claude-code', 'claude-desktop', 'opencode',
    'hermes-agent', 'openclaw', 'droid', 'pi', 'kimi', 'copilot-cli',
    'openai-compatible',
  ])
})

test('does not claim hosted desktop chats support model routing', () => {
  expect(getAppAdapter('claude-desktop')).toMatchObject({
    integrationKind: 'tool-only', readiness: 'tool-only',
  })
  expect(getAppAdapter('chatgpt').integrationKind).toBe('model-routing')
})
```

- [ ] **Step 2: Run the catalog tests to verify they fail**

Run: `bun test scripts/tovyr-apps/catalog.test.js`
Expected: FAIL because `catalog.js` does not exist.

- [ ] **Step 3: Implement immutable, validated manifests**

```js
export const APP_INTEGRATION_KINDS = Object.freeze([
  'model-routing', 'tool-only', 'manual-setup',
])
export const APP_READINESS = Object.freeze([
  'ready', 'manual-setup', 'tool-only', 'missing', 'unsupported-version',
])

const APPS = Object.freeze([
  Object.freeze({
    id: 'codex', label: 'Codex CLI', integrationKind: 'model-routing',
    readiness: 'ready', protocol: 'openai-responses', command: 'codex',
  }),
  // Include every requested ID. Use `manual-setup` until its current
  // configuration contract is researched and fixture-tested.
])

export function listAppAdapters() { return APPS.map(app => ({ ...app })) }
export function getAppAdapter(id) {
  return listAppAdapters().find(app => app.id === String(id).toLowerCase()) || null
}
```

Populate the catalog with these exact classifications:

| ID | Kind | Initial readiness |
|---|---|---|
| `codex` | model-routing | ready |
| `chatgpt` | model-routing (Codex view only) | ready on discovered AppX/desktop package; otherwise missing |
| `claude-code` | model-routing | ready when the CLI is found |
| `claude-desktop` | tool-only | tool-only |
| `opencode`, `hermes-agent`, `openclaw`, `droid`, `pi`, `kimi` | manual-setup | manual-setup |
| `copilot-cli` | tool-only | tool-only |
| `openai-compatible` | manual-setup | manual-setup |

- [ ] **Step 4: Run catalog tests to verify they pass**

Run: `bun test scripts/tovyr-apps/catalog.test.js`
Expected: PASS.

- [ ] **Step 5: Review only the task files**

Run: `git diff --check -- scripts/tovyr-apps/catalog.js scripts/tovyr-apps/catalog.test.js`
Expected: exit 0. Do not commit because the repository contains user-owned changes.

## Task 2: Add platform discovery and honest application status

**Files:**
- Create: `scripts/tovyr-apps/discovery.js`
- Create: `scripts/tovyr-apps/discovery.test.js`

**Interfaces:**
- Consumes `getAppAdapter()` from the catalog.
- Produces `parseWindowsAppxExecutable(output)`, `discoverApp(adapter, runtime)`, and `listAppStatuses(runtime)`.
- `runtime` is injectable: `{ platform, findCommand, runPowerShell, exists }`; production defaults wrap `process.platform`, `where.exe`/`which`, and PowerShell.

- [ ] **Step 1: Write failing fixture-driven discovery tests**

```js
test('discovers Microsoft Store ChatGPT as OpenAI.Codex', () => {
  const status = discoverApp(getAppAdapter('chatgpt'), {
    platform: 'win32',
    runPowerShell: () => 'C:\\Program Files\\WindowsApps\\OpenAI.Codex_x64\\app\\ChatGPT.exe\n',
    exists: path => path.endsWith('ChatGPT.exe'),
    findCommand: () => null,
  })
  expect(status).toMatchObject({ id: 'chatgpt', readiness: 'ready' })
})

test('keeps a known but unverified client manual', () => {
  expect(discoverApp(getAppAdapter('hermes-agent'), fakeRuntime)).toMatchObject({
    readiness: 'manual-setup', executable: null,
  })
})
```

- [ ] **Step 2: Run discovery tests to verify they fail**

Run: `bun test scripts/tovyr-apps/discovery.test.js`
Expected: FAIL because discovery exports do not exist.

- [ ] **Step 3: Implement discovery without shell interpolation**

```js
export function discoverApp(adapter, runtime = productionRuntime()) {
  if (adapter.integrationKind === 'tool-only') {
    return { ...adapter, executable: null, readiness: 'tool-only', reason: adapter.recovery }
  }
  const executable = adapter.id === 'chatgpt' && runtime.platform === 'win32'
    ? parseWindowsAppxExecutable(runtime.runPowerShell(CHATGPT_APPX_QUERY))
    : runtime.findCommand(adapter.command)
  return executable
    ? { ...adapter, executable, readiness: 'ready', reason: null }
    : { ...adapter, executable: null, readiness: adapter.readiness, reason: adapter.recovery }
}
```

Use `execFileSync` argument arrays for `where.exe`, `which`, and
`powershell.exe`. The ChatGPT PowerShell query must identify the `OpenAI.Codex`
AppX package and return only `app\\ChatGPT.exe`; it must never invoke the
legacy `codex app` installer path.

- [ ] **Step 4: Run discovery tests to verify they pass**

Run: `bun test scripts/tovyr-apps/discovery.test.js scripts/tovyr-app-cli.test.js`
Expected: PASS.

- [ ] **Step 5: Add an explicit unsupported-version result**

Add a fixture with an executable but a version probe below the adapter's
`minimumVersion`, assert `readiness: 'unsupported-version'`, and include the
minimum version in `reason`. Run the same command and confirm PASS.

## Task 3: Persist managed connection metadata safely

**Files:**
- Create: `scripts/tovyr-apps/managed-state.js`
- Create: `scripts/tovyr-apps/managed-state.test.js`

**Interfaces:**
- Produces `createManagedState(home)`, returning
  `readConnection(id)`, `saveConnection(record)`, `removeConnection(id)`,
  `recordBackup(id, sourcePath, content)`, and `restoreBackup(id, writeFile)`.
- Connection record shape:

```js
{
  version: 1,
  appId: 'chatgpt',
  integrationKind: 'model-routing',
  gateway: { host: '127.0.0.1', port: 11434 },
  managedFields: [],
  backupPath: null,
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z'
}
```

- [ ] **Step 1: Write failing isolated-home state tests**

```js
test('stores a redacted connection manifest with owner-only file mode', () => {
  const state = createManagedState(tempHome)
  state.saveConnection({ ...record, gatewayToken: 'do-not-store-this' })
  expect(readFileSync(state.connectionPath('chatgpt'), 'utf8')).not.toContain('do-not-store-this')
  expect(state.readConnection('chatgpt')).toMatchObject({ appId: 'chatgpt' })
})

test('restores only a recorded backup to its original target', () => {
  const state = createManagedState(tempHome)
  state.recordBackup('codex', configPath, 'before')
  expect(state.restoreBackup('codex', writeFileSync)).toEqual({ restored: true, path: configPath })
})
```

- [ ] **Step 2: Run the state tests to verify they fail**

Run: `bun test scripts/tovyr-apps/managed-state.test.js`
Expected: FAIL because managed state does not exist.

- [ ] **Step 3: Implement atomic manifests and backups**

Store manifests below `<TOVYR_HOME>/.tovyr/apps/`. Validate `appId` against the
catalog ID pattern, serialize to a sibling temporary file, then rename it.
Drop all keys matching `/token|secret|api.?key/i` before writing. Keep backups
below `<TOVYR_HOME>/.tovyr/apps/backups/<appId>/` and require the exact stored
target path when restoring.

- [ ] **Step 4: Run state tests to verify they pass**

Run: `bun test scripts/tovyr-apps/managed-state.test.js`
Expected: PASS.

- [ ] **Step 5: Add failure-path coverage**

Add tests for malformed manifests, a backup target mismatch, and failed atomic
rename. Each must return a structured error without deleting the original
connection or backup. Run the state test file and confirm PASS.

## Task 4: Implement manager operations over injected dependencies

**Files:**
- Create: `scripts/tovyr-apps/operations.js`
- Create: `scripts/tovyr-apps/operations.test.js`

**Interfaces:**
- Consumes catalog, discovery, managed state, and a gateway controller.
- Produces `createApplicationManager(deps)` with async methods
  `list()`, `status(id)`, `configure(id, selection)`, `launch(id, selection, passthrough)`, `disconnect(id)`, `restore(id)`, and `doctor(id)`.
- `deps` includes `discover`, `state`, `startGateway`, `spawnClient`,
  `connectedModelChoices`, and `now`; tests provide fakes.

- [ ] **Step 1: Write failing operation tests**

```js
test('launches ready Codex through one selected qualified model', async () => {
  const manager = createApplicationManager(fakeDeps)
  await manager.launch('codex', { id: 'openrouter::openai/gpt-5', providerId: 'openrouter', modelId: 'openai/gpt-5' }, [])
  expect(fakeDeps.startGateway).toHaveBeenCalledWith({ persistent: false })
  expect(fakeDeps.spawnClient).toHaveBeenCalledWith('codex', expect.arrayContaining(['-m', 'openrouter::openai/gpt-5']), expect.any(Object))
})

test('returns a tool-only explanation instead of launching Claude Desktop', async () => {
  await expect(manager.launch('claude-desktop', selection, [])).resolves.toMatchObject({
    kind: 'tool-only', command: 'tovyr mcp serve',
  })
})
```

- [ ] **Step 2: Run operations tests to verify they fail**

Run: `bun test scripts/tovyr-apps/operations.test.js`
Expected: FAIL because the manager module does not exist.

- [ ] **Step 3: Implement operation semantics**

Implement these exact results:

```js
// ready routing client
{ kind: 'launched', appId, qualifiedModel, gateway: { host, port }, persistent }
// manual setup client
{ kind: 'manual-setup', appId, endpoint: 'http://127.0.0.1:11434/v1', protocol, instructions }
// tool-only client
{ kind: 'tool-only', appId, command: 'tovyr mcp serve', reason }
// missing/unsupported client
{ kind: 'unavailable', appId, readiness, reason }
```

Use existing Codex launch arguments, Claude environment sanitization, and
Windows ChatGPT AppX discovery as injected adapter actions. `configure()` may
create a managed manifest only after a verified adapter supplies a patch;
otherwise it returns the endpoint recipe without editing external config.
`disconnect()` and `restore()` operate only through `managed-state.js`.

- [ ] **Step 4: Run operations tests to verify they pass**

Run: `bun test scripts/tovyr-apps/operations.test.js scripts/tovyr-apps/managed-state.test.js`
Expected: PASS.

- [ ] **Step 5: Add lifecycle regressions**

Add tests that an existing healthy gateway is reused, a ChatGPT launch requests
`persistent: true`, failed client spawning stops only a gateway created for
that attempt, and a pre-existing manual `tovyr serve` process is never stopped.
Run the operations test file and confirm PASS.

## Task 5: Migrate the existing launcher to the manager

**Files:**
- Modify: `scripts/tovyr-app-cli.js`
- Modify: `scripts/tovyr-app-cli.test.js`
- Modify: `bin/tovyr.js`
- Modify: `bin/tovyr.ps1`

**Interfaces:**
- Consumes `createApplicationManager()` and `buildAppModelChoices()`.
- Preserves the existing direct aliases: `tovyr codex`, `tovyr claude`,
  `tovyr chatgpt`, `tovyr launch <app>`.
- Adds manager command forms without changing bare interactive Tovyr startup.

- [ ] **Step 1: Write failing CLI command-routing tests**

```js
test('maps apps status to manager status without a model picker', async () => {
  await main(['apps', 'status', 'codex'], fakeIo)
  expect(fakeManager.status).toHaveBeenCalledWith('codex')
  expect(fakeIo.output).toContain('readiness')
})

test('maps launch aliases through the same manager operation', async () => {
  await main(['launch', 'opencode', '--provider', 'openrouter', '--model', 'openai/gpt-5'], fakeIo)
  expect(fakeManager.launch).toHaveBeenCalledWith('opencode', expect.objectContaining({ id: 'openrouter::openai/gpt-5' }), [])
})
```

- [ ] **Step 2: Run CLI tests to verify they fail**

Run: `bun test scripts/tovyr-app-cli.test.js`
Expected: FAIL because the manager has not yet been injected into the launcher.

- [ ] **Step 3: Replace ad-hoc app branching with manager dispatch**

Keep `parseAppInvocation()` and `resolveChoice()` as the CLI boundary. Add
these parsed forms:

```text
apps list
apps status [app]
apps configure <app> [--provider ID --model ID]
apps launch <app> [--provider ID --model ID] [-- ...client args]
apps disconnect <app>
apps restore <app>
apps doctor [app]
```

Use the same `main()` path for `tovyr launch <app>` and `tovyr apps launch
<app>`. Keep direct short aliases. Update `bin/tovyr.js` and `bin/tovyr.ps1`
only if a new top-level alias is added; do not add a second command parser.

- [ ] **Step 4: Run CLI and Windows launcher tests to verify they pass**

Run: `bun test scripts/tovyr-app-cli.test.js services/tovyr/launcherStartupContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Smoke-test non-mutating commands**

Run: `node bin/tovyr.js apps list`
Expected: every requested application appears exactly once with a readiness state.

Run: `node bin/tovyr.js apps status chatgpt`
Expected: on this Windows host, discovery identifies `OpenAI.Codex` rather than opening an installer.

## Task 6: Add endpoint recipes and targeted diagnostics

**Files:**
- Modify: `scripts/tovyr-apps/catalog.js`
- Modify: `scripts/tovyr-apps/operations.js`
- Modify: `scripts/tovyr-apps/operations.test.js`
- Modify: `scripts/tovyr-doctor.js`
- Modify: `scripts/tovyr-cli-ux.js`
- Modify: `docs/GUIDE.md`

**Interfaces:**
- Each `manual-setup` manifest has `protocol`, `endpointPath`, `modelFormat`,
  and `instructions` that return a Tovyr-qualified model identifier.
- `doctor` consumes `manager.doctor(id)` and emits only safe status, endpoint,
  and recovery commands.

- [ ] **Step 1: Write failing recipe and doctor tests**

```js
test('uses the OpenAI-compatible recipe for Hermes without exposing a provider key', async () => {
  const result = await manager.configure('hermes-agent', selection)
  expect(result).toMatchObject({ kind: 'manual-setup', endpoint: 'http://127.0.0.1:11434/v1' })
  expect(JSON.stringify(result)).not.toMatch(/sk-|api[_-]?key/i)
})

test('reports Claude Desktop as tool-only with an actionable MCP command', async () => {
  expect(await manager.doctor('claude-desktop')).toMatchObject({
    readiness: 'tool-only', recoveryCommand: 'tovyr mcp serve',
  })
})
```

- [ ] **Step 2: Run recipe tests to verify they fail**

Run: `bun test scripts/tovyr-apps/operations.test.js`
Expected: FAIL because manual recipes and doctor output are incomplete.

- [ ] **Step 3: Implement explicit safe recipes**

For OpenAI-compatible manual clients return:

```text
Base URL: http://127.0.0.1:11434/v1
API key: a local Tovyr gateway token only when loopback auth is enabled
Model: <provider>::<model>
```

For Anthropic-compatible clients return the root endpoint
`http://127.0.0.1:11434` and the same qualified model. The response must state
that the client remains `manual-setup` until its current official config
contract is independently verified. Add `apps doctor` to the lightweight
doctor output as a read-only check; do not probe providers or start gateway
processes during a normal `tovyr doctor` run.

- [ ] **Step 4: Run recipe, CLI, and doctor tests to verify they pass**

Run: `bun test scripts/tovyr-apps/operations.test.js scripts/tovyr-app-cli.test.js scripts/tovyr-quality-gates.test.js`
Expected: PASS.

- [ ] **Step 5: Document the support matrix**

Add a compact table to `docs/GUIDE.md` with columns **Client**, **Integration**,
**Current state**, and **Command**. Include every catalog ID, clearly label
manual and tool-only rows, document `apps status`, `apps doctor`,
`apps disconnect`, and `apps restore`, and preserve the ChatGPT AppX discovery
note.

## Task 7: Run the foundation quality gate

**Files:**
- Modify only files required by failed verification; do not reformat unrelated code.

**Interfaces:**
- Verifies Tasks 1–6 against the spec's foundation acceptance criteria.

- [ ] **Step 1: Run focused application and gateway tests**

Run:

```powershell
bun test scripts/tovyr-apps scripts/tovyr-app-cli.test.js services/tovyr/platform/gateway services/tovyr/launcherStartupContract.test.ts
```

Expected: all tests pass with no skipped failure.

- [ ] **Step 2: Run static validation**

Run: `npm run typecheck:tovyr`
Expected: exit 0.

- [ ] **Step 3: Exercise safe runtime flows**

Run:

```powershell
node bin/tovyr.js apps list
node bin/tovyr.js apps status chatgpt
node bin/tovyr.js apps doctor claude-desktop
```

Expected: no installer launches, no provider credentials print, every output
contains a readiness state and a concrete recovery path where not ready.

- [ ] **Step 4: Inspect the scoped diff**

Run:

```powershell
git diff --check -- scripts/tovyr-apps scripts/tovyr-app-cli.js scripts/tovyr-app-cli.test.js scripts/tovyr-cli-ux.js scripts/tovyr-doctor.js docs/GUIDE.md bin/tovyr.js bin/tovyr.ps1
```

Expected: exit 0. Leave the scoped changes uncommitted because this workspace
contains unrelated user-owned modifications.

## Follow-on plan boundary

After this foundation ships, create one research-and-adapter plan for the
current official contracts of OpenCode, Hermes Agent, OpenClaw, Droid, Pi,
Kimi, and Copilot CLI. Each adapter moves from `manual-setup` or `tool-only`
to `ready` only after official current documentation, a configuration fixture,
and a gateway smoke test prove its route. Do not guess config-file formats or
claim that a hosted desktop chat can change its model backend.
