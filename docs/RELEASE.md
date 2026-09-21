# Graft 1.4.0 source preview

Validation performed on Windows on September 20, 2026:

| Check | Result |
| --- | --- |
| Complete public snapshot suite (`bun test src scripts`) | 1,743 passed, 1 skipped, 0 failed |
| Runtime compilation | Passed |
| Real Chromium fixture | Fill, click, assertions, mobile screenshot, failed assertion, cancellation, and recovery passed |
| Installed Windows command | Version and help passed; Start menu shortcut and icon installed |
| Linux/macOS source installer | Bash syntax checked; not executed on Linux or macOS |
| Dependency audit | Zero advisories reported by `npm audit` |
| Public staged secret scan | Gitleaks reported no leaks |
| Broad TypeScript check | Not passing: 3,138 diagnostics |

The TypeScript baseline includes missing React/Lodash declarations and inherited SDK interface mismatches. Runtime compilation and tests do not establish that every application path works. This is not a certified or fully typechecked release.

Provider regression tests cover selected-endpoint routing, credential/cache isolation, late model-list responses, model activation failure/retry, and timeout/rate-limit classification. Live NVIDIA NIM catalog access succeeded, but the selected inference request timed out after 30 seconds. Other providers were not exhaustively tested with live credentials. A listed model is not proof of successful inference or tool support.

Installers build from source and require Node.js 22+, Bun, and Git. There are no native MSI, EXE, DMG, or Linux system packages. Browser tests require an installed Chromium-family browser and use fresh contexts, without personal cookies or profiles.

The documentation screenshot contains simulated sample prompts and results rendered with Graft components. It contains no personal desktop or conversation history. No promotional video is included.

The public file selection excludes private settings, sessions, credentials, browser artifacts, development notes, `.github`, `.superpowers`, and npm state. Required provider identifiers and third-party notices are retained.

### Local learning and explanation follow-up

The updated public snapshot passes 1,759 tests with one skip and no failures. Runtime compilation and the installed Windows version command pass. The production dependency audit reports zero advisories. The broad TypeScript check still fails (3,140 diagnostics, including missing declarations and SDK mismatches); no diagnostics reference the new learning service or command. Live provider latency has not been remeasured for this update.

Folder-explanation requests now reject mutating tool actions, and narrated code examples no longer become automatic writes. Read/search groups stay compact, with available failure details passed through to expanded rows. `/learn` manages local project preferences and fixed failure lessons; it does not train model weights or modify application code.

### Developer workflow verification

The subsequent public snapshot passes 1,776 tests with one skip and no failures. Runtime compilation and Windows installation pass. A live installed-CLI run using the configured NVIDIA model fixed an empty-array bug in an isolated JavaScript fixture and reported a passing test; a separate `node --test` invocation confirmed the result. The run took 64 seconds. This verifies a small coding workflow, not a general latency guarantee or every model/provider.

Source installs now require ripgrep on PATH. Real file enumeration and content search passed through the runtime search wrapper. The installers check the dependency, and `graft doctor` reports it. Linux/macOS installation has still only received shell syntax checks locally.

A live web search returned eight results, including the official TypeScript handbook, in approximately 0.74 seconds. Regression tests cover snippet attribution, URL decoding, duplicate removal, cancellation, and unavailable-service reporting. A stalled local provider fixture verifies the separate connection timeout and suppression of automatic retries. Existing broad TypeScript failures remain; this is not a fully typechecked release.

### Project overview and source history

The latest public snapshot passes 1,792 tests with one skip and no failures. Runtime compilation and the installed Windows version command pass. Both new local command loaders delivered their expected output against isolated demo data. The dependency audit reports zero advisories. The broad TypeScript check still reports 3,135 diagnostics; none reference the new overview/source services or commands, or the changed repository map. Live provider latency was not remeasured for this update.

`/project` displays bounded local metadata without invoking a model or running package scripts. `/sources` distinguishes completed search results from fetched pages and ignores links present only in model prose. Topic-based repository maps now prioritize relevant paths and symbols within their character budget. The chat layout remains unchanged; these summaries appear on request.

### Visible verification and Git workflow

The final public snapshot passes 1,801 tests with one platform-specific skip and no failures. Runtime compilation and the updated Windows installation pass.

The Git workflow now previews changes locally, commits only already-staged files, and previews Git undo before applying a history-preserving revert. Automatic pre-edit stashing and automatic post-verification commits were removed. Existing file-history backup behavior remains available. Post-edit verification and agent autofix prepare normal shell-tool work, where permissions, progress, and cancellation apply; prompt loading does not run project scripts. Verification bookkeeping is isolated by project and agent.

Real Git fixtures verify that previews leave files and the index unchanged, commits preserve unstaged and untracked work, stale undo requests are rejected, and an applied revert preserves commit history. Command-loader fixtures cover `/changes` and `/undo git`. The dependency audit reports zero advisories; the broad TypeScript check remains at 3,135 diagnostics with unchanged per-file/error-code counts.

A live installed-CLI coding fixture using the configured GLM 5.3 Flash model did not finish within 120 seconds. It read the fixture but did not edit it or pass the independent test before the harness stopped it. The first two model responses took approximately 41 and 55 seconds to begin; completed read/search tools took 3–23 milliseconds. Files, staged state, and history remained intact. This run does not demonstrate a completed live coding workflow or improved provider latency.

## Provider refresh and inference audit — September 2026

Reviewed core provider endpoints and bootstrap model choices against official documentation; added Synthetic and NanoGPT, corrected compatible transports, and removed retired GitHub Models from selection. Current model examples include GPT-6 Astra, Claude Fable 5.1, Gemini 3.8 Flash, and Grok 4.6. Live account catalogs remain authoritative; other cloud, media and custom-provider templates are not certified by this review.

`/model refresh [all]` and `/model check [all]` expose cancellable discovery and bounded text probes. The CLI equivalent prints each model's result. Pagination, empty inventories, stale-cache isolation, configuration changes, rate limits and interrupted checks have regression coverage. Native Astra tool calls route through Responses; a local HTTP fixture verifies function calls and their IDs, and fragmented-stream tests cover text, tool arguments and failures. No live OpenAI account was available for this verification.

A live audit found 413 OpenRouter entries (397 chat candidates) and 82 NVIDIA NIM entries (67 candidates). It attempted 117 short probes with an eight-second deadline: 35 OpenRouter and 11 NIM models returned output. OpenRouter stopped after 50 attempts when rate-limited. NIM attempted all 67 candidates; the remaining outcomes included 47 unclassified errors, seven timeouts, one network error and one invalid-model response. Four empty OpenRouter results were initially classified unavailable; the final code now treats empty short-budget results as inconclusive. Probe output may include reasoning text and does not certify coding quality. These counts describe the observed run, not permanent availability. Ollama and LM Studio did not return usable catalogs; other accounts were not connected. No existing provider or model choice was changed.

Official references: [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model), [Anthropic models](https://platform.claude.com/docs/en/models/overview), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Groq models](https://console.groq.com/docs/models), [Cerebras models](https://inference-docs.cerebras.ai/models/overview), [xAI](https://docs.x.ai/overview), [Synthetic](https://dev.synthetic.new/docs/openai/chat-completions), [NanoGPT](https://docs.nano-gpt.com/), and [GitHub Models retirement](https://docs.github.com/en/github-models).

The broad TypeScript check reports 3,137 diagnostics: the previous 3,135 baseline plus two missing React declaration diagnostics in the new model-audit view. These are not suppressed; the project is not typecheck-clean. Windows runtime compilation and the complete public-snapshot test suite are checked separately. macOS and Linux are not tested on this PC.

Final snapshot validation: 1,816 tests passed, one skipped, and zero failed across 286 files. Runtime compilation passed. The dependency audit reported zero advisories.

## OpenRouter model selection correction

OpenRouter now uses its standard OpenAI-compatible API for discovery and inference. Sending an Anthropic compatibility header to its catalog endpoint had produced rewritten IDs such as `anthropic/z-ai/glm-5.2:free`; the normal catalog returns `z-ai/glm-5.2:free`. Changing the transport invalidates the old catalog cache. The picker displays the exact API ID and labels catalog entries as listed, not verified on the account. Validation consults the requested provider's inventory before vendor-name heuristics, even when another provider is active. Ambiguous model-name shortcuts are rejected. Regression coverage follows the selected ID through discovery, display, validation and a fixture inference request.

## Model-check error reporting

The model picker now explains rate limits, expired credentials and credit limits even when a gateway returns only "Provider returned error". HTTP status and numeric Retry-After hints are retained. A rate-limited selection leaves the previous configuration intact. HTTP 402 is classified as a credit or quota issue; the setup heading says configured rather than claiming inference readiness. Connection-check cache entries are invalidated when credentials change.

## Shared provider recovery

Model selection reuses recent inference evidence: successful checks for five minutes and inconclusive failures for 45 seconds. Explicit `/model check` probes bypass this cache; changing credentials or endpoints invalidates it. An ambiguous HTTP 404 is held only briefly, while a confirmed missing-model response retains the longer model-specific quarantine. Unsupported request parameters no longer mark a model unavailable or trigger model failover. Failed selections preserve configuration and can suggest up to two models that recently answered an actual check on the same provider. Catalog-only entries never earn that recommendation. Fixture coverage includes OpenRouter, NVIDIA NIM, Groq, Cerebras and OpenAI; it does not certify live access to every provider.

## Remembering unavailable models

Confirmed unavailable models are now excluded from pickers across restarts for six hours. Evidence is scoped to the provider, endpoint and credentials. An ambiguous 404 is persisted only when another model has answered on the same endpoint; an audit applies that check after examining the whole batch. Rate limits, timeouts, authentication errors and endpoint-wide failures do not become persistent model exclusions. `/model check` bypasses exclusions and restores models that respond. The local cache stores only model/provider IDs, a credential-scope fingerprint and expiry times; no API keys, response bodies or conversation text. Cross-process regression tests verify persistence, recovery and credential isolation.
