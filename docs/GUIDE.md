# Graft guide

Start `graft` inside the project you want to work on. The header shows the active model and folder. Type a request in the composer; use `/help` for the current command list.

## Providers

Open `/provider` to configure a provider, then `/model` to select a model. Provider credentials are stored locally under `~/.graft/`. Model names remain the upstream provider's identifiers, including Claude models. Local Ollama models require an independently running Ollama server.

## Editing and planning

Use `/plan` for a read-only plan and `/code` to implement changes. Graft uses `graft.md` for project instructions and `graftplan.md` for plans. Existing legacy instruction files can still be read. Review unusual shell commands and destructive operations before approving them.

## Browser tests

Run your website's development server, then ask:

```text
/browser test http://localhost:5173
```

The model can inspect the accessibility snapshot, exercise controls, check mobile layout, and inspect test reports. The `WebsiteTest` tool uses a fresh local browser context on each call. Use complete test steps from the initial URL rather than expecting cookies or form state to survive between calls.

Reports and screenshots are saved to `.graft/browser/` in the project. Keep this directory out of version control. Page content is returned to the active model. Use test accounts and fixture data for form submissions.

`/browser setup` configures the optional Playwright MCP integration for more general interactive browsing. It is separate from the built-in website test tool. `/browser status` shows its configuration. Restart after changing MCP configuration.

## Activity display

Response text streams into the conversation. Live thinking uses one compact preview. Search and browser activity show colored site badges and domain names from observed tool results. The terminal version uses text badges rather than image favicons. Reduced motion keeps the status readable without animation.

## Installation and support

See the [README](../README.md) for installation and [INSTALL.md](INSTALL.md) for updates, troubleshooting, and removal. This source preview does not claim that every imported experimental feature or every provider has been verified.
