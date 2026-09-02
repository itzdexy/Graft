# Product Rename / Consistency Pass — Completed

## Decision

The product name remains **Tovyr**. No full rename was performed.

## What changed

### User-facing brand consistency

- `components/tovyr/TovyrWordmark.tsx` now renders the plain `Tovyr` wordmark instead of the retired two-tone treatment.
- `components/tovyr/TovyrBootScreen.tsx` now shows `◆ Tovyr` in the narrow-terminal fallback.
- `components/tovyr/TovyrWelcomePanel.tsx` now renders `Tovyr` with the brand gradient instead of the retired product name.
- `components/tovyr/TovyrHeader.tsx` now shows `Tovyr` instead of `TOVYR`.
- `components/tovyr/TovyrWorkspaceDashboard.tsx` now says `Welcome to Tovyr` instead of `Welcome to TOVYR`.
- `components/LogoV2/LogoV2.tsx` border titles now render `Tovyr` in `tovyrPrimary` instead of `TOVYR` in the legacy `claude` color key.
- `constants/product.ts` `PRODUCT_NAME` is now `Tovyr` instead of `TOVYR`.
- `package.json` description uses `Tovyr` instead of `TOVYR`.
- `main.tsx` program name is now `tovyr` instead of `claude`; the launch tip now says `tovyr`.
- `main.tsx` `mcp add-from-claude-desktop` was renamed to `mcp add-from-tovyr-desktop` with a legacy alias `add-from-claude-desktop`.
- `cli/handlers/mcp.tsx` now imports from `utils/tovyrDesktop.js` to match the `Tovyr Desktop` description.
- `entrypoints/cli.tsx` `--version` and `--help` outputs use `Tovyr` instead of `TOVYR`; the help header is now `Inside Tovyr:`.

### Test updates

- `services/tovyr/launcherStartupContract.test.ts` updated to expect `Welcome to Tovyr` and `<StreamingMarkdown>{displayStreamingText}</StreamingMarkdown>` to match current source.

### What stayed the same

- Package names: `tovyrcode`, `tovyrroute`.
- Binaries and launchers: `tovyr`, `tovyrcode`, `bin/tovyr.*`.
- Config directories: `~/.tovyr/`, `.tovyr/`.
- Plan and context files: `tovyrplan.md`, `tovyr.md`, `tovyr-critique.md`.
- Environment variables: `TOVYR_*`.
- Source directories: `services/tovyr/`, `commands/tovyr/`, `components/tovyr/`.
- VS Code extension IDs: `itsdexy.tovyr-code`.

## Validation

- `bun test services/tovyr/launcherStartupContract.test.ts` — 13 pass, 0 fail.
- `bun run lint` — clean.
- `bun run typecheck` — pre-existing errors (unrelated to this pass); see `docs/audits/REMEDIATION_BASELINE.md`.
