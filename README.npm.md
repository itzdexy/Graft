# Graft (current CLI: `tovyr`)

Graft is a terminal-native AI coding agent. The repository has been renamed to Graft, but the current v1.3.6 runtime, npm package metadata, and executable still use **Tovyr** identifiers. The working command is `tovyr`, **not** `graft`.

## Install from source

Requires [Bun](https://bun.sh/) and Node.js 18+.

```bash
git clone https://github.com/itzdexy/Graft.git
cd Graft
bun install
bun run build
npm install -g .
```

Open a new terminal after installation on Windows if the command is not found.

## Quick start

```bash
tovyr setup
tovyr auth login --key YOUR_API_KEY
cd path/to/your-project
tovyr
```

Configure a supported model provider with your own key. Be aware that commands containing credentials may be retained in shell history. Launch the agent inside the project you intend to work on, not from your home directory.

## Commands

| Command | Purpose |
| --- | --- |
| `tovyr` | Start the interactive agent |
| `tovyr --help` | Show CLI help |
| `tovyr --version` | Show version |
| `tovyr setup` | Check setup |
| `tovyr provider list` | Show configured providers |
| `tovyr provider use <id>` | Select a provider |
| `tovyr doctor` | Check runtime compatibility |

For agent modes, model selection, configuration, and troubleshooting, read the [full user guide](docs/GUIDE.md). See [SAFETY.md](docs/SAFETY.md) for documented permissions and safeguards.

The Graft name change is not yet a complete CLI/package rename; this document deliberately uses the executable and configuration names that currently exist.

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for provenance and third-party licensing context.
