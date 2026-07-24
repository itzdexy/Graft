# Changelog

All notable changes to Blink are documented here.

## [2.00.5] - 2026-07-16

### Open-source readiness
- Version unified to **2.00.5** across package manifests, constants, and UI
- Removed **Blink in Chrome** extension stack (CLI, MCP, docs, onboarding)
- Scrubbed user-facing Claude Code / Anthropic product branding (telemetry, updaters, doctor copy)
- Kept Anthropic as a selectable provider and legacy `CLAUDE_CODE_*` / `CLAUDE.md` compat fallbacks

### UI / UX redesign
- Animated buddy on welcome/header (idle fidget + working pose loop; respects reduced motion)
- Boot splash shows buddy + clearer phase text
- Single-row live tool activity (`+N more` overflow); BlinkWeb tool styling
- Footer modes: Plan / Code / Bypass / Superthink / Crush / Ask
- Codex-inspired plan review: `• Updated Plan` checklist, CHECKS strip, Approve / Request changes (hidden in bypass mode)
- Codex-style thinking bullet (`•`) in live activity and `>` prefix on user messages
- **Project map**: task-relevant file tree + import edges in sidebar, welcome, and plan review (uses cached `/repo` index)
- Codex-style tool rows: `● Bash(date)` with green/red status dots and `└` result (no more `needs attention` / `$` clutter)
- Fixed pending tool rows painting as error red while waiting for permission (now hollow `○` / warning)
- Ask mode auto-accepts Write/Edit and allowlisted shell (`git`, `gh`, `npm`, …); unusual/destructive commands still prompt
- Scrubbed remaining user-facing Claude/claude.ai product strings (MCP UI, doctor, remote control, marketplace toasts, tool rows)
- Config/state dirs now use **`.blink`** / **`~/.blink`** (and **`~/.blink.json`**) instead of `.claude`; legacy `.claude` still read for compat
- Fixed `entrypoints/cli.tsx` syntax error that broke `--warm-cache` compile prep on Windows
- **Images**: OpenAI-compat / FreeModel path now forwards pasted screenshots and tool images as multimodal `image_url` parts (Ctrl+V paste)

### Web tools
- Local DuckDuckGo search + HTML→markdown fetch pipeline stabilized
- Clearer empty-result errors for search/fetch

## [2.04.7] - 2026-07-03

### UI / UX (OpenCode-style agent workflow)
- Session header: `# Task title` with `tokens  context%  ($cost)` metrics (OpenCode / Codex pattern)
- Tool rows: `* Grep "pattern" (18 matches)`, `-> Read path`, `~ status` with match counts from Grep/Glob
- Live activity feed is borderless and linear (OpenCode workflow log)
- Footer: `Build · model` plus `esc interrupt · ctrl+p commands · /agent status`
- Ideas drawn from OpenCode, Codex, Gemini CLI, Claude Code, Cline, and claw-code agent TUIs

## [2.04.6] - 2026-07-03

### Agent mode (full autonomous CLI)
- Build/implement goals auto-start a persisted agent session with plan steps and auto-fix
- Active agent mission injected into the system prompt each turn (Observe→Execute→Verify loop)
- Step progress shown in the chat dock; `/agent status` for full plan
- CLI routing: `blink build …` and similar goals route to `/agent start --autofix`

## [2.04.5] - 2026-07-03

### UI / UX
- Chat dock pinned above the input (no more dead space pushing activity to the bottom of scrollback)
- Turn duration (`* Baked for 30s`) shows in the dock instead of the transcript
- Silent-turn notice when the model returns no visible reply
- Turn cards no longer prefix user text with a `|` accent bar

## [2.04.4] - 2026-07-03

### Fixes
- Edit/Write tools work in bypass mode (`/bypass`) — path validation now respects bypassPermissions after safety checks
- `auto` mode can write files inside the project folder without extra allow rules

## [2.04.3] - 2026-07-03

### UI / UX
- Unified welcome screen: one logo card + flat prompt list (no stacked double boxes)

## [2.04.2] - 2026-07-02

### Fixes
- Resumed sessions hide welcome logo and show session HUD immediately
- `/clear` restores welcome screen and example prompts
- Boot splash no longer stacks on top of LogoV2
- Chat dock stays visible briefly after each turn so mode/model epilogue can show
- Write/Edit transcript dedup uses full relative paths (not basename collisions)
- Example prompt paste normalization no longer rewrites unrelated messages

## [2.04.1] - 2026-07-02

### Fixes
- Welcome screen hides as soon as you send a message (not only after Blink replies)
- Example prompts use ASCII-only text (no garbled em dashes on Windows terminals)
- Copy-pasting a welcome prompt line sends only the hint text to the model
- User turn accent uses `|` for broader terminal compatibility

## [2.04.0] - 2026-07-02

### UI / UX
- Polished chat turns: rounded borders, role labels, teal accent bar
- API/rate-limit errors render as dedicated error turns with recovery hints
- Example prompts on empty chat (below welcome logo)
- Session HUD shows version, live MCP/model indicator, divider line
- Live activity panel gets a teal border while Blink is working
- Quick-start welcome panel matches Blink brand styling

## [2.03.150] - 2026-07-02

### UI / UX
- Welcome screen uses Blink quick-start + tips instead of Claude changelog column
- Boot splash on first paint (`BlinkBootScreen`) with progress bar
- Session HUD (project, model, tokens, cost) pinned above chat after first reply
- Welcome header auto-hides once Blink responds (more room for transcript)
- Duplicate assistant text rows collapsed (weak-model repeat blocks)
- Recent sessions preload on startup for welcome-screen history

### Fixes
- Restored `hideLogo` / `blinkChatActive` wiring dropped from REPL
- Dock no longer duplicates session header (HUD lives in transcript)

## [1.0.7] - 2026-06-29

### UI / UX
- Blink teal brand colors on dark terminals (replaces pink Blink accents)
- Accurate loading status: "Waiting for model" / "Running tools" instead of random spinner verbs
- Live activity panel shows model wait state, tool durations, and failures
- Welcome screen prioritizes Blink quick-start commands
- Blink guest-pass and billing upsells hidden in Blink runtime
- All assistant replies route through Blink text recovery (leaked tool syntax, write failures)

### Commands
- `/fix` — quick agent autofix shortcut
- `/agent` alias: `/autofix`
- Updated welcome quick-start panel with `/btw`, `/build`, `/debug`, etc.

### Performance
- Stream idle watchdog enabled by default (2 min timeout on hung API streams)
- Skip redundant NVIDIA NIM model-list warm-up when cache is fresh

### Release
- npm package includes `blink-warm.js` (fixes launcher crash on global install)
- `blink setup` distinguishes npm launcher vs full source checkout
- MIT `LICENSE` and this changelog added

### Fixes
- `react/compiler-runtime` import path in `AssistantThinkingMessage.tsx`
