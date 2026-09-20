# Graft

**v1.4.0** · Terminal-native AI coding agent.

This repository contains the source for Graft and its Bun-powered interactive CLI. The public command is `graft`.

## Install from source

Requires Node.js 18+, npm, and [Bun](https://bun.sh/).

```bash
git clone https://github.com/itzdexy/Graft.git
cd Graft
bun install
bun run build
npm install -g .
```

Start a new terminal on Windows if the command is not on PATH, then check:

```bash
graft --version
```

Run Graft from a project directory rather than your home directory:

```bash
cd path/to/your-project
graft
```

This source-install guide does not imply that Graft has already been published to the npm registry.

## Set up a provider

```bash
graft setup
graft auth login --key YOUR_API_KEY
graft provider list
```

Never commit credentials or paste real keys into issue reports. API-key support and model availability depend on your provider.

## Useful commands

| Command | Purpose |
| --- | --- |
| `graft` | Start interactive mode |
| `graft --help` | Show command help |
| `graft --version` | Show version |
| `graft setup` | Check your installation |
| `graft doctor` | Run diagnostics |
| `graft provider list` | List providers |
| `graft provider use <id>` | Change provider |
| `graft -p "prompt"` | Non-interactive prompt |

## Develop

```bash
bun install
bun run dev
bun test
bun run typecheck
bun run lint
```

The application entrypoint is `src/entrypoints/cli.tsx`. See the [repository README](README.md), [LICENSE](LICENSE), and [NOTICE](NOTICE).
