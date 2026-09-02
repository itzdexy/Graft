# Tovyr Name Collision Review

## Methodology

Each candidate was checked against:

- `npm` package registry (`npm.io`, `registry.npmjs.org`)
- GitHub repositories
- CLI command search (`web_search`)
- Existing developer tools and IDE extensions
- Trademark and domain obviousness

Risk levels:

- **Low** — no CLI/npm tool, no established tech company, no obvious trademark.
- **Moderate** — an older or niche project exists, but no dominant AI-coding-agent brand.
- **High** — a widely used CLI, active company, popular language/framework, or direct trademark.

## Summary by risk

### Low collision

- **Tovyr** — no AI-coding CLI or npm package; only a French RPG character reference. The product already owns `tovyrcode` and `itzdexy/Tovyr`.

### Moderate collision

- **Kairo** — `programmersd21/kairo` (Go terminal task manager, 237+ stars); `@kairoaisec/cli` (smart-contract security); `thekairojs/kairo` (JS framework); `ElhamDevelopmentStudio/kairo` (local-first dev intelligence).
- **Zircon** — `npm zircon` static site generator; `zirco-lang/zircon` toolchain installer; `erson/zircon` web server; `Zircon-Finance` SDK.
- **Sift** — `sift` is used by several security and data tools, but no dominant CLI brand.
- **Mote** — `npm mote` mustache engine; `Te29/mote` browser automation agent.
- **Shard** — generic database sharding and game references.
- **Wisp** — `wisp.place` AT Protocol CLI, `wisp-trading/wisp` trading framework, `@mercuryworkshop/wisp-js` proxy.

### High collision

Most short, dictionary-based names are saturated in the CLI and developer-tooling ecosystem:

- **Prism** — Stoplight Prism (132k+ weekly npm downloads), Prismatic, Prism.js.
- **Weave** — `weave-io/weave`, `@openweave/weave-cli`, `maximilien/weave-cli`, `@weave_protocol/cli`.
- **Glyph** — `glyphs-ai/glyph` agent CLI, `@glyphs/cli`, Glyph static site.
- **Chisel** — Canonical Chisel (Debian package slicing), `martinpllu/chisel` GPT-4 code loop, `chisel-engine` workflow engine.
- **Tilde** — `tilde.run` sandbox platform and CLI, Tilde (runoff sandbox).
- **Trace** — `burrows99/trace-cli`, RisingStack Trace, `trace` npm package (long stack traces).
- **Latch** — `latchagent/latch` MCP proxy, `latchbio/latch` bioinformatics framework.
- **Spool** — `spool-lab/spool` agent session sharing (297+ stars), `@bkincz/spool` micro-frontend CLI.
- **Cairn** — `fagemx/edda`-adjacent decision memory and multiple `cairn` CLI projects.
- **Rivet** — `rivet.dev` game/multiplexer platform, `@rivetkit/cli`, `@ironclad/rivet-cli`.
- **Flint** — Grafana `flint` (Rust), `flint.fyi` linter.
- **Helix** — Helix editor, `typed-ember/glint`.
- **Circuit, Flux, Pulse, Spark, Bolt, Dash, Nexus, Pilot, Forge, Mason, Loom, Stitch, Braid, Plait, Cipher, Codex, Axiom, Tenet, Verity, Coda, Sage** — each has at least one active npm package, GitHub CLI, or well-known tech company.

## Top five detailed review

### 1. Tovyr (current)

- **npm**: `tovyrcode` and `tovyrroute` are the project's own packages.
- **GitHub**: `itzdexy/Tovyr` and related repos.
- **CLI collision**: none in AI-coding-agent space.
- **Trademark/domain**: no obvious tech trademark.
- **Risk**: Low.

### 2. Kairo

- **npm**: no unscoped `kairo` package for AI coding; exists as scoped security task-manager.
- **GitHub**: `programmersd21/kairo` terminal task manager (237 stars) directly competes for the command name.
- **Trademark**: common Japanese word (回路 = circuit) and Greek name; not a clear tech trademark.
- **Risk**: Moderate-High (name conflict with a terminal task manager and a JS framework).

### 3. Chisel

- **npm**: `chisel-engine`, `chiselsh`, and others.
- **GitHub**: Canonical `chisel` (409 stars) for Debian package carving; `martinpllu/chisel` for GPT-4 code editing; `shivkanthb/chisel` workflow engine.
- **Trademark**: generic common word, but multiple established tools.
- **Risk**: High.

### 4. Zircon

- **npm**: `zircon` static site generator; `zirco-lang/zircon` toolchain.
- **GitHub**: `erson/zircon` web server; `Zircon-Finance` SDK.
- **Trademark**: mineral name, low trademark concern but domain scarcity.
- **Risk**: Moderate.

### 5. Tilde

- **npm/CLI**: `tilde-cli` from `tilde.run` for sandboxed commands (direct command conflict).
- **GitHub**: `tilderun/tilde-cli`.
- **Trademark**: Tilde is a common terminal symbol and a well-known platform name.
- **Risk**: High.

## Recommendation

**Tovyr is the safest name.** It has the lowest collision profile and the most existing project-specific equity. If a rebrand is mandatory, Kairo or Zircon are the least risky new names; all other shortlist alternatives face established CLI or company conflicts.
