# Tovyr CLI UI Audit

## Current strengths

- **Fast terminal boot**: warm compile + early stdin capture (CONIN$) on Windows; startup loader with visible progress.
- **Compact launch card**: `TovyrBootScreen` uses a bordered card with the diamond `◆`, `T O V Y R` gradient, progress bar, and a rotating tip.
- **Inline tool status**: `TovyrLiveActivity` shows per-tool rows with spinners and state.
- **Permission gating**: `FilePermissionDialog` and related components ask before file/shell/browser actions.
- **Mode badge**: `TovyrModeBadge` and `StatusLine` indicate `plan` / `code` / `bypass` / `superthink`.
- **Windows-first launchers**: `tovyr.cmd`, `tovyr.ps1`, and `tovyr.js` handle TTY detection and PATH.

## Current gaps

- **Help text**: `tovyr --help` lists slash commands and env vars, but does not expose subcommands (`mcp`, `plugin`, `auth`, `doctor`).
- **Command discoverability**: only `/?` and `?` reveal shortcuts after the UI loads.
- **Activity row noise**: multiple spinners can stack; the distinction between "thinking" and "tool running" is unclear.
- **Error presentation**: errors are dumped inline; no one-line summary + expansion pattern.
- **Approval UX**: permission dialogs do not surface the exact command/file and alternatives in one view.
- **Workspace view**: there is no dedicated full-screen workspace with plan, memory, tools, and output side-by-side.
- **Theme/color consistency**: some components use hard-coded hex gradients (`TovyrWelcomePanel`) while others use the theme token system.
- **Brand consistency**: all user-facing text now says `Tovyr` (fixed in this pass), but some internal command names and color keys still reference the upstream assistant (`claude` color token, `CLAUDE_*` env vars).

## Recommended fixes (in priority order)

1. **Consolidate brand tokens**: use `tovyrPrimary` / `tovyrSecondary` / `tovyrAccent` everywhere; retire user-facing `claude` color key.
2. **One live activity row**: merge thinking and tool spinners into a single, cancellable activity row per task.
3. **Error expansion pattern**: one-line summary + `--show` / `?` to expand details.
4. **Permission card v2**: show action, tool, exact command, file, risk, scope, and `once | session | workspace | deny` choices in one screen.
5. **Help everywhere**: `--help`, `?`, and `/help` should route to the same, searchable command index.
6. **Workspace mode**: add `tovyr workspace` with a three-pane layout (plan, chat, tool/terminal output) behind a feature flag.
7. **Keyboard control map**: document and implement `Ctrl+C`, `Ctrl+D`, `Ctrl+L`, `Ctrl+R`, `Ctrl+P`, `Ctrl+O`, `Tab`.
8. **Reduced motion and colorless support**: all motion and color must respect `NO_COLOR`, `TERM=dumb`, `CI`, and config.

## Files reviewed

- `components/tovyr/TovyrBootScreen.tsx`
- `components/tovyr/TovyrWelcomePanel.tsx`
- `components/tovyr/TovyrHeader.tsx`
- `components/tovyr/TovyrWorkspaceDashboard.tsx`
- `components/tovyr/TovyrWordmark.tsx`
- `components/tovyr/TovyrLiveActivity.tsx`
- `components/LogoV2/LogoV2.tsx`
- `components/LogoV2/CondensedLogo.tsx`
- `components/permissions/FilePermissionDialog/usePermissionHandler.ts`
- `components/StatusLine.tsx`
- `components/PromptInput/PromptInput.tsx`
- `entrypoints/cli.tsx`
- `main.tsx`
