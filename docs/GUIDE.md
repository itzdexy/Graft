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

Web search distinguishes unavailable service from an empty result, shares a 20-second deadline across its fallback requests, and propagates cancellation. Search snippets are leads; open the linked pages before relying on detailed claims. Source URLs are deduplicated, and snippets stay attached to their own result.

## Project learning

Graft keeps local project preferences and fixed lessons from tool failures. These guide later prompts; they do not retrain model weights or automatically rewrite the application. Automatic observations store only lesson identifiers and counters, without tool inputs, outputs, or conversation text.

Use `/learn remember Prefer concise explanations` to save a preference, `/learn list` to inspect it, `/learn forget 1` to remove a preference, and `/learn clear` to clear this project's preferences and observations. `/learn off` disables automatic observations and prompt use; `/learn on` restores them. Preferences are sent to the active model when learning is on. Store no confidential information in preferences. Data stays under your local `.graft/learning` directory and is excluded from the public source export.

Clear folder-explanation requests use read-only tools. Graft starts with the README and manifest and is instructed to answer without scanning every file. Read/search batches stay collapsed until expanded explicitly; failed tools show their reported error when available.

## Installation and support

See the [README](../README.md) for installation and [INSTALL.md](INSTALL.md) for updates, troubleshooting, and removal. This source preview does not claim that every imported experimental feature or every provider has been verified.

## Coding, research, and verification

Use `/build <feature>` for implementation, `/debug <problem>` for investigation, and `/review` for a review without edits. These workflows focus on relevant files, preserve the existing stack, and require evidence for reported results. `/research <question>` asks for source-backed findings, version compatibility, and explicit uncertainty; `/deep-research <question>` produces a longer report.

Bare `/verify` now starts all detected checks through the normal shell-tool workflow, where permission checks, progress, and cancellation apply. `/verify test` or `/verify lint,typecheck` selects a subset; `/verify help` shows usage. Missing checks are reported as unconfigured. Verification alone does not request source fixes. Package-manager declarations take precedence over leftover lockfiles, and detection does not invent missing tests or choose `lint:fix` as a check.

Post-edit verification and `/agent autofix` also request checks through the normal shell tool. They do not execute scripts while preparing prompts or automatically commit passing changes. Pending verification is tracked separately for each project and agent. Existing tool results from after the latest edit can be reused, and recovery requests are bounded. Model compliance and provider tool support still determine whether requested checks actually run; inspect the reported tool results.

## Reviewing and committing changes

`/changes` displays staged and working-tree status, added/removed line counts, and untracked entries without a model request. It covers the whole Git repository, shows at most 40 entries, and reads metadata rather than patch bodies. Binary files are labeled; untracked directories are grouped without line counts. Rename detection is disabled, so a rename appears as a deletion and an addition. This is a change inventory, not a code review; use `/review` or `git diff` to examine the code.

Edits no longer stash or stage the working tree automatically. The edit tools retain their existing file-history backups when file checkpointing is enabled. `/git-commit <summary>` commits only the changes already staged by the user; other edits and untracked files remain outside that commit.

`/undo git` previews the latest eligible `graftcode:` commit. Apply the displayed `/undo git apply <commit>` command to create a new revert commit while preserving history. Git undo refuses pending changes, a changed commit ID, and root or merge commits. Bare `/undo` retains its conversation-rewind behavior.

## Context and response speed

`/project` shows a local overview of the current folder: detected stack, Git changes, top-level files, and available package scripts. It does not call a model or run those scripts. Large folders are bounded and marked with an ellipsis; Git status has a two-second timeout.

`/repo map <topic>` ranks matching file paths and symbols before larger unrelated files. The map stays within its character budget and includes partial symbol lists when a whole file would not fit.

`/sources` lists up to 40 recent links from completed web tools in the last 200 conversation messages. It distinguishes search results from successfully fetched pages, removes duplicates, and ignores links written only in model prose. A fetched page is not an independently verified claim. Failed fetches and redirects do not earn a fetched label. This command does not make a model request.

Graft uses the active provider's reported context capacity when available, including compatible endpoint metadata. Model-specific documented limits are used when the endpoint omits them; unknown models retain a conservative fallback. Capacity includes room for output and a safety margin. Tool-call arguments count toward the input budget.

OpenAI-compatible connections have a 30-second deadline to begin their response, separate from the stream idle watchdog. A connection timeout is reported without automatic retry. Set `GRAFT_CONNECT_TIMEOUT_MS` before launch to allow a slower model more time (100–600,000 milliseconds).

Nemotron 3.5 Lightning uses NVIDIA's documented 262,144-token context window unless the endpoint reports a different limit. Its optional thinking mode is off by default to avoid unnecessary reasoning on short requests. To opt in, set `GRAFT_ENABLE_MODEL_THINKING=1` before launching Graft. Provider inference speed and queueing still affect latency. See [NVIDIA's Lightning documentation](https://docs.nvidia.com/nim/large-language-models/2.0.10/get-started/advanced/get-started-nemotron-3.5-lightning.html).

## Updating and checking models

Use `/model refresh` to reload the active provider's live inventory, or `/model refresh all` for connected providers. Successful discovery replaces bootstrap choices, including paginated Anthropic and Gemini catalogs. A failed refresh preserves previous inventory and identifies it as stale. Saved custom endpoints and model choices are preserved. Catalog and readiness evidence are isolated by provider, endpoint, and credentials.

Use `/model check` or `/model check all` to send small, isolated text probes. Checks may incur provider charges. Two requests run at once per provider; authentication, quota and rate-limit errors stop new checks. Esc cancels. A listed model is not necessarily available to your account, and a short response does not certify tool calling, full context capacity, vision, or sustained streaming. Timeouts and empty short-budget responses remain inconclusive.

The terminal equivalents provide per-model results:

```sh
graft models refresh all
graft models check all --timeout 12000
graft models check nvidia_nim --limit 5 --timeout 20000
```

The optional limit applies per provider. No project files, conversations, or tool definitions enter these probes. Only connected providers are checked; Graft does not create accounts or purchase access. Models known to be embeddings, media, moderation or reranking targets are excluded from the text probe. Additional models can be entered manually where a provider supports custom model IDs.

Synthetic and NanoGPT are available in `/provider`. Current bootstrap choices and endpoint corrections are recorded with official documentation links in `scripts/graft-provider-updates.js`. GitHub Models is hidden because the service retired; GitHub Copilot is separate. Native GPT-6 Astra uses the Responses API for tool calls with remote conversation storage disabled. Other supported native OpenAI reasoning models use completion-token budgets and omit unsupported sampling controls. Third-party gateways retain their own transport conventions.
