# Product Rename Map

## Decision

**Final product name: Tovyr (unchanged).**

The naming phase concluded that Tovyr has the lowest collision profile, the strongest existing project equity, and the best fit for a terminal-native AI coding agent. No full rename will be performed.

This document maps every name surface and the action to take for each.

## Surface map

| Surface | Current value | Action | Notes |
|---------|---------------|--------|-------|
| Product name | Tovyr | Keep | Title case in prose, lowercase in commands. |
| CLI command | `tovyr` | Keep | No alias needed. |
| npm root package | `tovyrcode` | Keep | Existing package name. |
| npm router package | `tovyrroute` | Keep | Internal package slug. |
| Chrome extension package | `tovyr-for-chrome-mcp` | Keep | Legacy, consider deprecation separately. |
| Legacy Chrome extension | `tovyr-chrome-legacy-mcp` | Keep | Legacy, consider deprecation separately. |
| Launchers | `bin/tovyr.js`, `bin/tovyr.cmd`, `bin/tovyr.ps1`, `bin/tovyr` | Keep | Maintain Windows-first launchers. |
| Install script | `bin/install-tovyr.*` | Keep | Keep as `install-tovyr`. |
| Source dir `services/tovyr/` | `services/tovyr/` | Keep | Internal module prefix; no user-facing value in renaming. |
| Source dir `commands/tovyr/` | `commands/tovyr/` | Keep | Internal command prefix. |
| Source dir `components/tovyr/` | `components/tovyr/` | Keep | Internal component prefix. |
| Tool `TovyrWebTool` | `tools/TovyrWebTool/` | Keep | Internal tool name. |
| Constants | `constants/tovyr.js` | Keep | Internal. |
| System prompt | `constants/tovyrSystemPrompt.ts` | Keep | Internal. |
| Env var prefix | `TOVYR_*` | Keep | All environment variables stay `TOVYR_*`. |
| Config dir | `~/.tovyr/`, `.tovyr/` | Keep | Home and project config directories. |
| Plan artifact | `tovyrplan.md` | Keep | Project root plan file. |
| Project context | `tovyr.md` | Keep | Project memory file. |
| Critique artifact | `tovyr-critique.md` | Keep | Optional critique file. |
| VS Code extension | `itsdexy.tovyr-code` | Keep | Existing extension ID. |
| GitHub org/repo | `itzdexy/Tovyr` | Keep | Existing. |
| Wordmark | retired internal wordmark | Remove from user-facing UI | Keep compatibility details out of normal UI. |
| Kairo boot screen | `KairoBootScreen.tsx` | Rename to `TovyrBootScreen.tsx` | Leftover from earlier exploration; make consistent. |

## Consistency checks

- All user-facing strings should say "Tovyr" / `tovyr`.
- No user-facing strings should use retired product names or incorrect TovyrRoute casing.
- Internal files and module names can keep the `tovyr` prefix; do not rename `services/tovyr/`, `commands/tovyr/`, or `components/tovyr/` purely for cosmetic reasons.
- Environment variables, config directories, and plan filenames must remain `TOVYR_*`, `~/.tovyr/`, `tovyrplan.md`, and `tovyr.md`.
