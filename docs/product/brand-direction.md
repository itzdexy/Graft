# Tovyr Brand Direction

## Positioning

Tovyr is a terminal-native AI coding agent for developers who want speed, control, and multi-provider freedom. It is not a chat app, a web dashboard, or a replacement for an editor. It is the coding partner that sits in your shell, follows your plan, and executes with precision.

## Brand attributes

- **Sharp** — fast, crisp, no wasted words or pixels.
- **Capable** — can plan, search, edit, run shell, use the browser, and remember.
- **Transparent** — shows what it is doing, why, and how to stop or inspect it.
- **Trustworthy** — asks for permission, does not hide risks, recovers cleanly.
- **Terminal-native** — looks and feels like it belongs in the shell, not a browser.

## Naming and wordmark

- **Product name**: Tovyr
- **Command**: `tovyr`
- **NPM package**: `tovyrcode` (distribution package) and `tovyrroute` (router package)
- **Pronunciation**: **TOH-veer** (rhymes with "smear"). The hard "T" and the "vyr" ending make it terminal-friendly.
- **Casing rules**:
  - Product name: **Tovyr** (sentence case for body, title case for headings).
  - CLI command and package slug: **tovyr** / **tovyrcode** / **tovyrroute**.
  - Environment variables and internal identifiers: `TOVYR_*`.
  - Private/internal modules: `tovyr` prefix in lowercase.
- **Wordmark**: `Tovyr` in plain text. No special logo in the CLI. The retired internal wordmark is removed from user-facing code.

## Visual identity

### Icon

- Primary icon: a diamond outline `◆` (U+25C6). It represents a cut gem: many facets, precision, and clarity.
- Fallback or inline: `◇` (U+25C7) for inactive states.
- Do not use sparkles, stars, robots, or generic "AI" icons.

### Color tokens

TUI colors are semantic, not decorative. The default theme assumes 256-color or truecolor support and falls back to 16-color on older terminals.

| Token | Default | Purpose |
|-------|---------|---------|
| `tovyrPrimary` | `#7C3AED` (violet 600) | brand, active model, selected items |
| `tovyrSecondary` | `#64748B` (slate 500) | muted labels, secondary borders |
| `tovyrAccent` | `#22D3EE` (cyan 400) | links, citations, tool activity highlights |
| `success` | `#22C55E` (green 500) | passed checks, accepted changes |
| `warning` | `#F59E0B` (amber 500) | warnings, pending approval |
| `danger` | `#EF4444` (red 500) | errors, denied actions, destructive ops |
| `info` | `#3B82F6` (blue 500) | hints, info panels |
| `muted` | `#94A3B8` (slate 400) | timestamps, metadata, disabled |
| `background` | `#0F172A` (slate 900) | main background (dark mode) |
| `surface` | `#1E293B` (slate 800) | panels, cards, status line |
| `border` | `#334155` (slate 700) | separators, box borders |
| `text` | `#F8FAFC` (slate 50) | primary text |
| `code` | `#E2E8F0` (slate 200) | inline code, file paths |
| `toolName` | `#A78BFA` (violet 400) | tool labels |
| `citation` | `#22D3EE` (cyan 400) | web/search citations |

### Terminal presence

- Compact startup card: diamond `◆`, name, version, active model, provider, permission mode, tool count, and help hint. No ASCII art.
- Status line at the bottom of the session: model, mode (plan / code / bypass / superthink), provider, cost/session, and a help shortcut.
- Live activity row: one line per active tool with spinner, elapsed time, and concise status.
- Errors: one-line summary + optional `--show` expansion; never stack traces by default.
- Respect `NO_COLOR`, `TERM=dumb`, `CI=true`, non-TTY output, and `FORCE_COLOR`.

### Tone of voice

- Direct and concise. One line is better than three.
- Technical, not casual. Avoid emojis except where the user has asked for them.
- Specific. Say "Read `src/utils/path.ts:24-37`" instead of "I looked at a file".
- Action-oriented. Lead with what was done, then the result, then optional detail.
- Honest about limits. If a tool cannot do something, say exactly why and offer the nearest alternative.

## Usage rules

- Use **Tovyr** for the product, **tovyr** for the command.
- Do not use "Tovyrcode" or "Tovyrroute" as the product name in user-facing text; they are package slugs.
- Do not use retired product names or incorrect TovyrRoute casing in user-facing UI or docs.
- Always pluralize as "Tovyr sessions", "Tovyr models", "Tovyr skills" — do not add an apostrophe.
- The config directory is `~/.tovyr/` (or `%USERPROFILE%\.tovyr\` on Windows) and the project marker is `.tovyr/`.
- The default plan artifact is `tovyrplan.md` in the project root; the project memory file is `tovyr.md`.

## Expansion and sub-brands

- IDE extensions: `itsdexy.tovyr-code`, `itsdexy.tovyr-*`.
- Chrome extension: `tovyr-for-chrome-mcp`.
- Marketplace: "Tovyr Skill Registry" or "Tovyr Plugin Directory".
- Docs site: `tovyr.dev` or `docs.tovyr.dev` (preferred, subject to availability).
- Installer: `install-tovyr`.

## Files

- Theme tokens: `components/design-system/themeTokens.ts`
- Startup screen: `components/tovyr/TovyrBootScreen.tsx`
- Wordmark component: `components/tovyr/TovyrWordmark.tsx`
- Status line: `components/StatusLine.tsx`
