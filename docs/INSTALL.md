# Installation details

Use the [README installers](../README.md). Node.js 22+, Bun, Git, and ripgrep (`rg`) must be installed first. Graft's source distribution uses ripgrep from PATH for Glob/Grep; `graft doctor` checks its availability.

## Update

Pull changes in your checkout and rerun its installer:

```powershell
git pull --ff-only
.\install.ps1 -SourcePath .
```

```bash
git pull --ff-only
bash install.sh --source .
```

Without `--source` / `-SourcePath`, installers clone into `~/.local/share/graft`. They refuse to replace an existing directory. Source installations point the launcher at that checkout, so keep it in place.

## Troubleshooting

- Command not found: reopen the terminal and check `~/.local/bin` is on PATH.
- Browser not found: install Chrome, Edge, Brave, or Chromium, or set `GRAFT_BROWSER_PATH`.
- Ollama unreachable: start `ollama serve`, or select another provider.
- Linux browser dependencies: install your distribution's Chromium package and its libraries.
- First launch may take longer while Bun prepares the runtime.

## Remove

Remove the launcher from `~/.local/bin` (`graft.cmd` on Windows), then remove the installation checkout if no longer needed. Settings remain in `~/.graft`; remove them separately only if you intend to delete saved credentials and sessions. Node.js, Bun, and your browser remain installed.
