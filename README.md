# Graft

**v1.4.0** · AI coding agent for your terminal.

Graft works in your project directory. It can inspect a codebase, plan changes, edit files, run commands with permission controls, and connect to supported AI model providers. You stay in control of what the agent can execute.

## Features

- **Codebase context:** read files and search an existing project.
- **Coding workflows:** plan, review, and apply changes from the terminal.
- **Provider choice:** configure supported providers and switch models.
- **Tool access:** run shell commands, use optional web tools, and inspect results.
- **Permission controls:** review sensitive or destructive actions before they run, according to the active mode.

Feature availability depends on your provider, model, configuration, and platform.

## Requirements

- [Bun](https://bun.sh/) for the application runtime.
- Node.js 18+ and npm for the launcher and build scripts.
- Git for installing from source.

## Install from source

```bash
git clone https://github.com/itzdexy/Graft.git
cd Graft
bun install
bun run build
npm install -g .
```

On Windows, open a new terminal after installing if the command is not immediately available. This is a source installation; the repository does not claim that a `graft` package is published to the npm registry.

Check the installation:

```bash
graft --version
```

You can also run `bun run dev` from the source checkout without a global installation.

## Quick start

Check your environment:

```bash
graft setup
```

Configure a supported API provider, for example:

```bash
graft auth login --key YOUR_API_KEY
```

Use your actual provider key, and avoid exposing it in screenshots or shell history. Then move into a project folder and start Graft:

```bash
cd path/to/your-project
graft
```

Run Graft from the project you intend it to access rather than from your home directory.

## Commands

| Command | Description |
| --- | --- |
| `graft` | Start the interactive coding agent |
| `graft --help` | Show available commands |
| `graft --version` | Show the product version |
| `graft setup` | Check installation and configuration |
| `graft doctor` | Diagnose runtime and platform problems |
| `graft provider list` | List configured providers |
| `graft provider use <id>` | Choose a provider |
| `graft -p "prompt"` | Run a non-interactive prompt |

Interactive workflows include `/plan`, `/code`, `/agent`, and `/provider`. Their behavior depends on configuration and connected models.

## Development

```bash
bun install
bun run dev
bun test
bun run typecheck
bun run lint
```

The application entry point is [`src/entrypoints/cli.tsx`](src/entrypoints/cli.tsx). `bin/` contains command launchers; `scripts/` contains build and release tooling; `docs/` contains additional reference material.

## Security and licensing

Review proposed edits and commands, and do not commit API keys, tokens, or personal configuration files. Read the [safety documentation](docs/SAFETY.md) for details about permission handling.

MIT licensed. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for licensing and third-party provenance.
