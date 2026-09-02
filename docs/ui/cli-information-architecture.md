# Tovyr CLI Information Architecture

## Command hierarchy

```
tovyr                               # default: interactive chat
tovyr [prompt]                      # start with a one-off prompt
tovyr --print "..."                 # non-interactive output
tovyr run "..."                     # alias for tovyr [prompt]
tovyr chat [prompt]                 # explicit chat (same as default)
tovyr workspace                     # full workspace TUI (feature flag)
tovyr research <query>              # deep research with citations
tovyr browser <url|action>          # browser automation
tovyr tools <subcmd>                # tool registry management
tovyr skills <subcmd>               # skill registry management
tovyr memory <subcmd>               # project + global memory
tovyr sessions <subcmd>             # session list / resume / fork / kill
tovyr models <subcmd>               # list / switch / test models
tovyr config <subcmd>               # get / set / list config
tovyr doctor [--fix|--export]       # diagnostics
tovyr update [rollback]             # self-update
tovyr mcp <subcmd>                  # MCP server management
tovyr plugin <subcmd>               # plugin management
tovyr auth <subcmd>                 # authentication
```

All subcommands inherit global options: `-d, --debug`, `--no-color`, `--plugin-dir`, `--rc`, `--verbose`, `--bare`.

## Interactive slash commands

| Command | Mode | Purpose |
|---------|------|---------|
| `/provider` | all | Switch provider and model |
| `/model` | all | Select a model for the active provider |
| `/plan` | all | Draft `tovyrplan.md` without editing code |
| `/code` | all | Implement the active plan |
| `/agent <task>` | all | Start an autonomous multi-step task |
| `/browser <url>` | all | Open the browser tool |
| `/mcp` | all | Manage connected MCP servers |
| `/skill` | all | List / load / install skills |
| `/buddy` | all | Inspect or edit Buddy memory |
| `/superthink` | all | Run localhost clarification Q&A |
| `/deep-research` | all | Build a sourced report |
| `/compare` | all | Benchmark models |
| `/config` | all | Open settings |
| `/init` | all | Create `tovyr.md` for the project |
| `/doctor` | all | Run diagnostics |
| `/update` | all | Self-update |
| `?` | all | Show keyboard shortcuts |

## Screen structure

### Chat screen (default)

```
┌ Tovyr · project · branch · INDEX 42% ───────────────────────┐
│                                                              │
│  ┌─────────────────────────────────────┐                     │
│  │ ◆ T O V Y R  · Starting up · 0.4s  │  (boot only)       │
│  └─────────────────────────────────────┘                     │
│                                                              │
│  [message history]                                           │
│  ┌───────────────────────────────────────────┐               │
│  │ ● WebSearch  0.8s  3 results              │  (live row)   │
│  └───────────────────────────────────────────┘               │
│                                                              │
│  > _                                                        │
│  plan · model · ?                                           │  (footer)
└──────────────────────────────────────────────────────────────┘
```

### Workspace screen (`tovyr workspace`)

```
┌─ Tovyr workspace · model ──────────────────────────────────┐
│  plan  │  chat / tool output  │  memory / skills            │
│  tovyrplan.md                │                         ... │
│                              │                              │
│  [plan tasks]                │  [messages + live output]    │
│                              │                              │
└──────────────────────────────────────────────────────────────┘
```

### Status line / footer

- Left: mode badge (`plan`, `code`, `bypass`, `superthink`).
- Middle: active provider/model.
- Right: cost/session, shortcut hint (`?` for help).

## Information flows

1. **User input** → `PromptInput` → slash command or natural language.
2. **Slash command** → route to command handler (in-place or subcommand).
3. **Natural language** → `QueryEngine` → model router → tool loop.
4. **Tool call** → permission check → execution → `TovyrLiveActivity` update.
5. **Tool result** → collapse/merge → append to Messages → update memory.
6. **Plan** → write `tovyrplan.md` → `/code` executes steps.
7. **Agent** → loop of plan/action/verify until done or interrupted.

## Keyboard controls

| Key | Action |
|-----|--------|
| `Ctrl+C` | Cancel current tool / stop agent / exit if idle |
| `Ctrl+D` | Exit cleanly |
| `Ctrl+L` | Clear screen (redraw) |
| `Ctrl+R` | Search command history |
| `Ctrl+P` | Command palette |
| `Ctrl+O` | Expand latest tool output |
| `Tab` | Autocomplete slash commands |
| `?` | Show shortcuts |
| `/` | Show all slash commands |
| `↑ / ↓` | Navigate history |

## Permission model

- **Tool risk levels**: `none`, `low`, `medium`, `high`, `destructive`.
- **Approval scopes**:
  - `once` — allow this call only.
  - `session` — allow for this session.
  - `workspace` — allow for this project.
  - `deny` — reject and remember.
- **Bypass mode**: user can opt into auto-accept for allowlisted tools, but destructive actions always ask.

## Color and motion

- Theme tokens live in `components/design-system/themeTokens.ts`.
- Respect `NO_COLOR`, `TERM=dumb`, `CI=true`, and `prefersReducedMotion`.
- Default theme is dark; `dark`, `light`, `light-daltonized`, `dark-daltonized`, `light-ansi`, `dark-ansi`.

## Accessibility

- All spinners have a text equivalent.
- Color is not the sole signal; use icons (`◆`, `●`, `✓`, `!`) and labels.
- Reduced-motion users see static state, not animation.
- Terminal width < 36 falls back to single-line status.
