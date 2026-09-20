# Graft

A terminal-native AI coding agent for working in an existing codebase. Graft can inspect project files, propose and apply edits, run commands with permission controls, and connect to supported AI model providers.

> **Naming status:** This repository is named **Graft**, but the current v1.3.6 application still uses the `tovyr` executable, `TOVYR_*` environment variables, and `~/.tovyr/` configuration directory. The CLI has **not** yet been renamed to `graft`; the commands below use the names implemented in the code.

## What it does

- Explore files and search a workspace before changing code.
- Plan changes, edit files, and run shell commands through an interactive terminal interface.
- Switch between configured providers and models.
- Use optional agent workflows, web tools, and verification features.
- Review permission prompts for sensitive or destructive operations.

Features depend on your provider, model, configuration, and platform. See the [user guide](docs/GUIDE.md) for the full command reference and [safety documentation](docs/SAFETY.md) for permission behavior.

## Requirements

- [Bun](https://bun.sh/) for the application runtime
- Node.js 18 or newer and npm for the launcher and build scripts
- Git to clone the source

The project targets Windows, macOS, and Linux. Consult the [user guide](docs/GUIDE.md) for platform-specific setup and troubleshooting.

## Install from source

```bash
git clone https://github.com/itzdexy/Graft.git
cd Graft
bun install
bun run build
npm install -g .
```

Open a new terminal after installation if the command is not found on Windows. The source package currently installs the `tovyr` command (and a `tovyrcode` alias); **`graft` is not an available command yet**.

To run the source entry point without a global install, use `bun run dev` from the repository directory.

## Get started

Run the setup check:

```bash
tovyr setup
```

Configure a supported provider. For example, the existing FreeModel authentication flow is:

```bash
tovyr auth login --key YOUR_API_KEY
```

Replace `YOUR_API_KEY` with your own key. Take care when entering credentials into a terminal: commands may be saved in shell history. See the [guide](docs/GUIDE.md) for provider configuration and local-model options.

Then **change into the project you want to work on** before starting the agent:

```bash
cd path/to/your-project
tovyr
```

Do not launch it from your home directory: the agent works on the current directory, and a home-directory scan can be unnecessarily broad.

## Useful commands

| Command | Purpose |
| --- | --- |
| `tovyr` | Start the interactive agent |
| `tovyr --help` | Display CLI help |
| `tovyr --version` | Display the version |
| `tovyr setup` | Check the installation and configuration |
| `tovyr provider list` | Show configured providers |
| `tovyr provider use <id>` | Choose a provider |
| `tovyr doctor` | Diagnose the runtime and platform |

The interactive application also has `/plan`, `/code`, `/agent`, and `/provider` workflows; availability and behavior are described in the [guide](docs/GUIDE.md).

## Development

```bash
bun install
bun run dev
bun test
bun run typecheck
bun run lint
```

The main source entry point is [`src/entrypoints/cli.tsx`](src/entrypoints/cli.tsx). Launchers are in [`bin/`](bin/), build and release scripts in [`scripts/`](scripts/), and public documentation in [`docs/`](docs/).

The repository and its current CLI still contain legacy Tovyr identifiers. Renaming internal identifiers or packaging without updating their dependencies can break startup, so this documentation update does not pretend that migration is complete.

## Security and licensing

Never commit API keys, `.env` files, access tokens, or user configuration. Check the files you stage before publishing. See [SAFETY.md](docs/SAFETY.md) for the project's documented safeguards; you should still review agent-proposed edits and commands.

Licensed under [MIT](LICENSE). See [NOTICE](NOTICE) for attribution and third-party licensing information.
