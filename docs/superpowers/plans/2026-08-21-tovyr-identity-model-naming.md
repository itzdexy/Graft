# Tovyr Identity and Model Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Tovyr identity migration and guarantee that provider-owned model names, especially Claude models, are never rebranded as Tovyr models.

**Architecture:** Add one pure display-name boundary used by catalogs and every picker surface, then correct source data and strengthen the existing repository brand checker. Update package/docs/Git metadata to the canonical `itzdexy/Tovyr` repository without rewriting third-party protocol names or Git history.

**Tech Stack:** TypeScript, JavaScript ES modules, Bun test, Ink, Node scripts, Git

**Spec:** `docs/superpowers/specs/2026-08-21-tovyr-chat-model-orchestration-design.md`

## Global Constraints

- Anthropic models render as `Claude Opus 5`, `Claude Sonnet 5`, `Claude Haiku 4.5`, and equivalent provider-correct names.
- Tovyr branding never replaces a third-party vendor or model-family name.
- Provider wire model IDs remain byte-for-byte unchanged.
- Canonical repository URL: `https://github.com/itzdexy/Tovyr`.
- Do not launch `tovyr.exe`; run Bun/source commands from the project directory.
- Preserve existing user changes and use path-limited commits.
- Compatibility aliases are allowed only when existing installations require them and must remain invisible in normal UI.

## File Structure

- Create `scripts/tovyr-model-display.js`: runtime-neutral canonical model display-name formatter shared by Node scripts and Bun/TypeScript.
- Create `scripts/tovyr-model-display.d.ts`: typed formatter contract for TypeScript consumers.
- Create `services/tovyr/modelDisplayName.test.ts`: vendor-identity regression tests.
- Modify `scripts/tovyr-provider-catalog.js`: provider-correct source labels and defensive lookup formatting.
- Modify `services/tovyr/models/registry.data.ts`: provider-correct registry display names.
- Modify `services/tovyr/catalogModels.ts`: format provider-discovered labels consistently.
- Modify `utils/model/modelOptions.ts`: route active-provider picker options through the formatter.
- Modify `components/tovyr/TovyrModelSelector.tsx`: render formatted labels while retaining IDs for selection.
- Modify `components/tovyr/TovyrProviderModelPicker.tsx`: format list and confirmation labels.
- Modify `services/tovyr/providerSetup.ts`: format connection confirmation names.
- Modify `scripts/check-tovyr-brand.js`: reject legacy product-name and stale repository residue.
- Create `scripts/check-tovyr-brand.test.js`: pure scanner regression tests.
- Modify package metadata, READMEs, docs, doctor output, and Git remote/branch metadata containing stale identity.

---

### Task 1: Canonical provider model display-name boundary

**Files:**
- Create: `scripts/tovyr-model-display.js`
- Create: `scripts/tovyr-model-display.d.ts`
- Create: `services/tovyr/modelDisplayName.test.ts`

**Interfaces:**
- Consumes: provider ID, provider wire model ID, and an optional catalog/provider label.
- Produces: `formatProviderModelDisplayName(input: ProviderModelDisplayInput): string`.

- [ ] **Step 1: Write the failing formatter tests**

```ts
import { describe, expect, test } from 'bun:test'
import { formatProviderModelDisplayName } from '../../scripts/tovyr-model-display.js'

describe('formatProviderModelDisplayName', () => {
  test('preserves Claude identity for registry and stale branded labels', () => {
    expect(formatProviderModelDisplayName({
      providerId: 'anthropic',
      modelId: 'claude-opus-5',
      label: 'Opus 5',
    })).toBe('Claude Opus 5')
    expect(formatProviderModelDisplayName({
      providerId: 'openrouter',
      modelId: 'anthropic/claude-sonnet-5',
      label: 'Tovyr Sonnet 5',
    })).toBe('Claude Sonnet 5')
  })

  test('does not rewrite other vendors or wire ids', () => {
    expect(formatProviderModelDisplayName({
      providerId: 'openrouter',
      modelId: 'openai/gpt-5.6-sol',
      label: 'GPT-5.6 Sol',
    })).toBe('GPT-5.6 Sol')
  })
})
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run: `bun test services/tovyr/modelDisplayName.test.ts`

Expected: FAIL because `scripts/tovyr-model-display.js` does not exist.

- [ ] **Step 3: Implement the pure formatter**

```ts
const CLAUDE_ID = /(?:^|[\/@.])claude[-_](?:3[-_])?(opus|sonnet|haiku|fable|mythos)(?:[-_]|$)/i
const CLAUDE_LABEL = /^(?:Tovyr|Claude)?\s*(?:(3\.[57])\s+)?(Opus|Sonnet|Haiku|Fable|Mythos)\b(.*)$/i

export function formatProviderModelDisplayName(input) {
  const raw = input.label?.trim() || input.modelId
  const isClaude = input.providerId === 'anthropic' || CLAUDE_ID.test(input.modelId)
  if (!isClaude) return raw
  const match = raw.match(CLAUDE_LABEL)
  if (!match) return raw.startsWith('Claude ') ? raw : `Claude ${raw}`
  const generation = match[1] ? `${match[1]} ` : ''
  return `Claude ${generation}${match[2]}${match[3]}`.trim()
}
```

- [ ] **Step 4: Run focused tests**

Run: `bun test services/tovyr/modelDisplayName.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only the formatter files**

Run:

```powershell
git add -- scripts/tovyr-model-display.js scripts/tovyr-model-display.d.ts services/tovyr/modelDisplayName.test.ts
git commit --only -m "fix: preserve provider model names" -- scripts/tovyr-model-display.js scripts/tovyr-model-display.d.ts services/tovyr/modelDisplayName.test.ts
```

### Task 2: Correct catalog and registry source data

**Files:**
- Modify: `scripts/tovyr-provider-catalog.js`
- Modify: `scripts/tovyr-provider-models-expanded.js`
- Modify: `scripts/tovyr-provider-catalog-extra.js`
- Modify: `services/tovyr/models/registry.data.ts`
- Modify: `services/tovyr/catalogModels.ts`
- Test: `services/tovyr/catalogModels.test.ts`
- Test: `services/tovyr/modelDisplayName.test.ts`

**Interfaces:**
- Consumes: `formatProviderModelDisplayName` from Task 1.
- Produces: provider-correct labels for static, registry, signed, and live model data.

- [ ] **Step 1: Add failing catalog and registry assertions**

Add tests that locate every model ID containing `claude` and assert its display label begins with `Claude `. Add an explicit registry assertion:

```ts
const opus5 = TOVYR_MODEL_REGISTRY.find(entry => entry.upstreamModelId === 'claude-opus-5')
expect(opus5?.displayName).toBe('Claude Opus 5')
```

- [ ] **Step 2: Run the focused tests**

Run: `bun test services/tovyr/catalogModels.test.ts services/tovyr/modelDisplayName.test.ts`

Expected: FAIL on direct Anthropic/FreeModel labels and registry names that omit `Claude`.

- [ ] **Step 3: Correct source labels and defensive formatting**

Change all Claude-family catalog and registry display names to the full provider-owned form. Replace `normalizeClaudeModelLabel(label)` calls with:

```js
formatProviderModelDisplayName({ providerId: provider.id, modelId, label })
```

In `humanizeOpenAiModelId`, call the canonical formatter after deriving the human label so discovered Claude IDs cannot lose provider identity.

- [ ] **Step 4: Run catalog, registry, and provider-model tests**

Run: `bun test services/tovyr/catalogModels.test.ts services/tovyr/providerModels.test.ts services/tovyr/modelDisplayName.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the corrected data boundary**

Run a path-limited commit containing only the files listed in this task with message `fix: keep Claude names in model catalogs`.

### Task 3: Use canonical labels across every model UI surface

**Files:**
- Modify: `utils/model/modelOptions.ts`
- Modify: `components/tovyr/TovyrModelSelector.tsx`
- Modify: `components/tovyr/TovyrProviderModelPicker.tsx`
- Modify: `services/tovyr/providerSetup.ts`
- Modify: `commands/model/model.tsx`
- Modify: `commands/tovyr/models.tsx`
- Test: `services/tovyr/providerSetup.test.ts`
- Test: `services/tovyr/modelDisplayName.test.ts`

**Interfaces:**
- Consumes: `formatProviderModelDisplayName` from Task 1.
- Produces: stable display labels while selection values remain provider wire IDs.

- [ ] **Step 1: Add failing surface-format tests**

Extend the provider-setup test:

```ts
expect(formatConnectedModelMessage({
  providerId: 'anthropic',
  modelId: 'claude-opus-5',
  providerLabel: 'Anthropic',
  modelLabel: 'Tovyr Opus 5',
})).toContain('Anthropic · Claude Opus 5')
```

Add a pure option-builder export from `modelOptions.ts` and assert `value === 'claude-opus-5'` while `label === 'Claude Opus 5'`.

- [ ] **Step 2: Run failing UI-helper tests**

Run: `bun test services/tovyr/providerSetup.test.ts services/tovyr/modelDisplayName.test.ts`

Expected: FAIL because confirmation and option surfaces accept unformatted labels.

- [ ] **Step 3: Route labels through the formatter**

Keep keys, selection values, persisted IDs, and API request models unchanged. Format only visible text:

```ts
const displayLabel = formatProviderModelDisplayName({
  providerId,
  modelId: model.id,
  label: model.label,
})
```

Use `displayLabel` in list rows, descriptions, current-model messages, and connection confirmations.

- [ ] **Step 4: Run focused tests and the Tovyr suite**

Run: `bun test services/tovyr/modelDisplayName.test.ts services/tovyr/providerSetup.test.ts services/tovyr/catalogModels.test.ts && bun test services/tovyr`

Expected: all tests PASS.

- [ ] **Step 5: Commit the UI-surface migration**

Commit only the files listed in this task with message `fix: show canonical model names everywhere`.

### Task 4: Complete product and repository identity migration

**Files:**
- Modify: `scripts/check-tovyr-brand.js`
- Create: `scripts/check-tovyr-brand.test.js`
- Modify: `package.json`
- Modify: `package.npm.json`
- Modify: `README.md`
- Modify: `README.npm.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/SAFETY.md`
- Modify: `docs/tovyr-agent-roadmap.md`
- Modify: `scripts/tovyr-doctor.js`
- Modify: branding/migration docs returned by `rg -l -i "blink"` outside ignored directories.
- Test: `scripts/tovyr-cli.integration.test.ts`

**Interfaces:**
- Consumes: canonical repository URL and explicit compatibility allowlist.
- Produces: `npm run check:brand` as the release gate for legacy names and stale repository links.

- [ ] **Step 1: Add failing brand-check fixtures**

Export a pure scanner helper and add cases constructed without embedding the forbidden literal in the checker source:

```js
const legacyName = ['bl', 'ink'].join('')
expect(scanText(`Welcome to ${legacyName}`, 'README.md')).toContain('legacy product name')
expect(scanText('https://github.com/itsdexy/Tovyr', 'README.md')).toContain('stale repository URL')
expect(scanText('browser blink event', 'vendor/protocol.md')).toEqual([])
```

- [ ] **Step 2: Run the scanner test and brand check and confirm failures**

Run: `bun test scripts/check-tovyr-brand.test.js; npm run check:brand`

Expected: FAIL on the five maintained historical references and stale `itsdexy/Tovyr` URLs.

- [ ] **Step 3: Implement the exact scan policy and migrate content**

Ignore `.git`, `node_modules`, `.superpowers`, `.claude`, generated runtime/cache directories, and the approved compatibility allowlist. Reject legacy product-name occurrences and any Tovyr repository URL whose owner is not `itzdexy`.

Update repository metadata to:

```json
{
  "repository": { "type": "git", "url": "git+https://github.com/itzdexy/Tovyr.git" },
  "bugs": { "url": "https://github.com/itzdexy/Tovyr/issues" },
  "homepage": "https://github.com/itzdexy/Tovyr#readme"
}
```

Rewrite historical maintained docs to say “legacy product name” without preserving the old brand as active copy.

- [ ] **Step 4: Verify metadata, docs, and source**

Run:

```powershell
npm run check:brand
bun test scripts/check-tovyr-brand.test.js scripts/tovyr-cli.integration.test.ts services/tovyr
rg -n -i "blink|github\.com/itsdexy/Tovyr" . -g '!node_modules/**' -g '!.git/**' -g '!.claude/**' -g '!.superpowers/**'
```

Expected: brand check and tests PASS; `rg` returns no maintained product residue.

- [ ] **Step 5: Commit product identity files only**

Commit only the files modified in this task with message `chore: complete Tovyr identity migration`.

### Task 5: Align local Git identity and final verification

**Files:**
- Verify only: repository worktree and Git configuration.

**Interfaces:**
- Consumes: canonical repository URL.
- Produces: local `origin` URL and current branch name that match Tovyr.

- [ ] **Step 1: Record current state without printing credentials**

Run: `git remote -v; git branch --show-current; git status --short`

- [ ] **Step 2: Update the origin URL**

Run: `git remote set-url origin https://github.com/itzdexy/Tovyr.git`

- [ ] **Step 3: Rename the current legacy branch if necessary**

If the current branch contains the legacy product name, run:

```powershell
git branch -m codex/tovyr-source-release
```

- [ ] **Step 4: Run final identity verification**

Run: `npm run check:brand; bun test services/tovyr; git remote -v; git branch --show-current`

Expected: brand check and tests PASS; origin is `itzdexy/Tovyr`; branch contains `tovyr`, not the legacy name.

- [ ] **Step 5: Confirm unrelated staged/unstaged work remains present**

Run: `git status --short`

Expected: pre-existing user changes remain; no unrelated file was committed or discarded.
