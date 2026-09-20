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
