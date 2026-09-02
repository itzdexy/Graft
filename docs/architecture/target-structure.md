# Tovyr Target Codebase Structure

## Current state

Most modules live in a flat `src/` root. This makes the dependency graph hard to trace and causes large files such as `main.tsx` (5,000+ lines) and `Messages.tsx` to absorb many responsibilities.

## Target directory layout

```
src/
  app/                  # Interactive TUI application
    App.tsx             # top-level Ink app / route switch
    AppState.tsx        # global React state
    Workspace.tsx       # full-screen workspace layout
    Chat.tsx            # chat + composer screen
    Boot.tsx            # startup / loading screen

  cli/                  # Commander CLI surface
    program.ts          # program config, name, global options
    commands/           # per-subcommand action handlers
      index.ts
      mcp.ts
      auth.ts
      provider.ts
      doctor.ts
      sessions.ts
      tools.ts
      skills.ts
      memory.ts
    flags.ts            # shared CLI flag helpers

  core/                 # Domain-agnostic building blocks
    config/             # config reading/writing
    env/                # env var parsing
    errors/             # error taxonomy, recovery, retry
    fs/                 # safe file operations
    logging/            # logEvent / logError / sinks
    platform/           # OS / runtime detection
    process/            # process, signals, stdin capture
    telemetry/          # opt-in telemetry
    theme/              # color, spacing, tokens
    types/              # shared TypeScript types

  engine/               # Model/tool/agent engine
    query/              # query parsing, slash commands, routing
    model/              # provider routing, failover, model selection
    tools/              # built-in tool registry and execution
    agent/              # /agent loop, plans, verification
    permissions/        # tool permission gates

  services/             # Long-lived services and integrations
    mcp/                # MCP client/server management
    browser/            # browser / playwright integration
    web/                # WebSearch / WebFetch
    skills/             # skill registry
    memory/             # project + global memory, buddy

  components/           # Ink UI components (keep, but flatten)
    design-system/      # theme, tokens, layout primitives
    tovyr/              # Tovyr-specific shell
    messages/           # message rendering
    permissions/        # permission dialogs
    prompts/            # prompt input and footer

  constants/            # Keep at root for launcher scripts
  scripts/              # Stand-alone JS scripts
  entrypoints/          # cli.tsx, server entrypoints
  tools/                # Individual tool implementations
  commands/             # In-app slash-command handlers
```

## Module dependency rules

1. `app/` may import `components/`, `engine/`, `services/`, `core/`, `constants/`.
2. `cli/` may import `core/`, `constants/`, `scripts/`, and lazy-load `app/` or `engine/`.
3. `engine/` may import `core/`, `services/`, `constants/`; must not import `app/` or `cli/`.
4. `services/` may import `core/`, `constants/`; must not import `app/` or `cli/`.
5. `components/` may import `core/`, `constants/`, and `services/` for data hooks; must not import `app/` or `cli/`.
6. `scripts/` may import `core/`, `constants/`; must not import `app/`, `engine/`, `services/` except via lazy `import()`.
7. `constants/` has no internal dependencies except environment / package metadata.

## Refactor strategy

1. **Phase A (preparation)**: enforce no import cycles with a lint rule; document public APIs.
2. **Phase B (extract CLI)**: move subcommand handlers from `main.tsx` into `cli/commands/`; leave `main.tsx` as a thin bootstrapper.
3. **Phase C (extract engine)**: split `query.ts`, `model` routing, and tool registry into `engine/`.
4. **Phase D (split UI)**: split `Messages.tsx` into `components/messages/`; split `AppState` and routing.
5. **Phase E (flatten tools)**: keep each tool in `tools/<Name>Tool/` with a standard `index.ts` exporting `Tool`.

## Legacy exceptions

- `constants/tovyr.js` stays at root because `bin/tovyr.js` and install scripts import it before any build step.
- `entrypoints/cli.tsx` and `main.tsx` stay as legacy bootstrap files until the CLI extraction is complete.
