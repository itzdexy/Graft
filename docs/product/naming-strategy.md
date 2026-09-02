# Tovyr Naming Strategy

## Product identity

Tovyr is a terminal-native AI coding agent built with Bun, React, and Ink. Its core value proposition is a fast, polished, multi-provider agent that lives in the developer's shell:

- **Reads and edits code** through a safe tool loop with file, shell, and patch tools.
- **Plans before it builds** with `/plan` → `tovyrplan.md`, then `/code` to implement.
- **Routes across providers** (FreeModel, OpenRouter, Ollama, LM Studio, custom OpenAI-compatible endpoints) with a curated, verified model catalog.
- **Remembers context** through Buddy memory, project `tovyr.md`, skills, and persisted sessions.
- **Runs in the terminal** on Windows, macOS, and Linux with first-class Windows/PowerShell support.

Target users are professional developers who want an agent that feels native to their terminal and stays under their control.

## Naming principles

The new name (if any) must be:

- Short (≈ 3–6 characters), pronounceable, and easy to type as a shell command.
- Memorable and technically credible, not generic "CodeAI" or "DevGPT" slop.
- Visually strong in a terminal and icon-friendly.
- Distinct enough to own on npm/GitHub in the AI-coding-agent space.
- Able to grow from a CLI into a desktop app, marketplace, and IDE ecosystem.

## Strategic naming directions

| Direction | What the product does | Sample words |
|-----------|----------------------|--------------|
| Precision and control | Diff-aware edits, permission gating, narrow tool calls | chisel, flint, sift, shard, trace, tact |
| Autonomy and execution | `/agent`, autonomous loops, multi-step goals | pilot, helm, relay, saga, quest, drive |
| Systems and infrastructure | Multi-provider routing, MCP, plugins, worktrees | nexus, circuit, node, lattice, mesh, bridge |
| Memory and learning | Buddy, skills, session recall, project `tovyr.md` | echo, lore, cairn, memento, sage, recall |
| Speed and responsiveness | Fast bare startup, streaming, warm compile | dash, bolt, spark, pulse, wisp, flint |
| Terminal and command interaction | Lives in the shell, slash commands, prompts | slash, tilde, clack, caret, prompt, type |
| Craftsmanship and engineering | Code as craft, plan-first, verified output | chisel, mason, wright, forge, loom, weave |

## Candidate longlist (45 names)

| # | Name | Command | Direction | Meaning | Product connection | Collision risk |
|---|------|---------|-----------|---------|-------------------|----------------|
| 1 | Kairo | `kairo` | Systems / autonomy | Japanese "circuit"; Greek kairos, "the right moment" | The agent runs code circuits and acts at the right time. | Moderate |
| 2 | Chisel | `chisel` | Craftsmanship | A precise carving tool | Code is shaped one careful, diff-aware edit at a time. | High |
| 3 | Zircon | `zircon` | Craftsmanship | A hard, brilliant gemstone | Durable, multifaceted, refracts many providers into clarity. | Moderate |
| 4 | Tilde | `tilde` | Terminal | `~` symbol; home, expansion, prompt | The agent starts at the terminal home prompt. | High |
| 5 | Sift | `sift` | Precision / research | To screen and separate the valuable from the noise | Sifts through search results and code to find signal. | Moderate |
| 6 | Trace | `trace` | Precision / research | Follow a path or sequence | Traces code paths, tool chains, and decisions. | High |
| 7 | Weave | `weave` | Craftsmanship / systems | Interlace threads | Weaves plans, code, memory, and providers into one run. | High |
| 8 | Glyph | `glyph` | Terminal / code | A written symbol or character | The CLI writes the symbols that become source code. | High |
| 9 | Prism | `prism` | Multi-provider / precision | Refracts light into a spectrum | One prompt, many provider/model outcomes, rendered clearly. | High |
| 10 | Shard | `shard` | Precision | A sharp fragment of a cut gem | Breaks big tasks into precise, manageable pieces. | Moderate |
| 11 | Mote | `mote` | Speed / lightness | A tiny particle | Fast, lightweight, surfaces the speck that matters. | Moderate |
| 12 | Riff | `riff` | Speed / creativity | A short repeated musical phrase | Quick, repeatable coding riffs from a prompt. | High |
| 13 | Tact | `tact` | Precision | A delicate touch; diplomacy | The right tool call at the right permission level. | High |
| 14 | Latch | `latch` | Memory / systems | A fastening that holds state | Latches session and memory state across turns. | High |
| 15 | Spool | `spool` | Speed / systems | A reel for thread or output | Spools up tasks, output, and background agents. | High |
| 16 | Cairn | `cairn` | Memory / learning | A stacked-stone trail marker | Durable waypoints in project memory and decisions. | High |
| 17 | Wright | `wright` | Craftsmanship | A maker or builder | The agent is a code-wright. | High |
| 18 | Rivet | `rivet` | Craftsmanship / systems | A permanent mechanical fastener | Binds code, plans, tools, and memory together. | High |
| 19 | Flint | `flint` | Speed / craftsmanship | Stone that strikes a spark | Fast, sharp, ignites the next step. | High |
| 20 | Wisp | `wisp` | Speed / lightness | A thin, drifting thread of smoke | Ephemeral, responsive, light in the terminal. | Moderate |
| 21 | Helix | `helix` | Systems / code | A spiral structure | Code, context, and memory coiled into a loop. | High |
| 22 | Circuit | `circuit` | Systems | A closed loop of components | The agent loop, provider network, and tool pipeline. | High |
| 23 | Flux | `flux` | Speed / systems | Continuous flow | Stream of prompts, tokens, and tool results. | High |
| 24 | Pulse | `pulse` | Speed / responsiveness | A heartbeat | The agent is alive and streaming. | High |
| 25 | Spark | `spark` | Speed / creativity | A small ignition | Quick code spark from a prompt. | High |
| 26 | Bolt | `bolt` | Speed / systems | A fastener and a lightning flash | Fasten code and run it quickly. | High |
| 27 | Dash | `dash` | Speed | A short, fast run | One quick command and go. | High |
| 28 | Echo | `echo` | Memory / learning | A reflected sound | Repeats project memory and verified facts back. | High |
| 29 | Nexus | `nexus` | Multi-provider | A connection point | Connects providers, tools, and memory. | High |
| 30 | Pilot | `pilot` | Autonomy | One who steers | Autopilot through multi-step coding tasks. | High |
| 31 | Forge | `forge` | Craftsmanship | Shape metal with heat | Forge code from raw material. | High |
| 32 | Mason | `mason` | Craftsmanship | A builder in stone | Builds solid code structures. | High |
| 33 | Loom | `loom` | Craftsmanship / systems | A frame for weaving | Weaves code, tests, and documentation together. | High |
| 34 | Stitch | `stitch` | Craftsmanship | A single loop of thread | Stitches plans, code, and tests into one deliverable. | High |
| 35 | Braid | `braid` | Systems / memory | Interweave strands | Braid providers, tools, memory, and skills. | High |
| 36 | Plait | `plait` | Craftsmanship | A braided strand | Interweave code and plans. | High |
| 37 | Cipher | `cipher` | Code / security | A secret or coded message | Writes and decodes code; respects permission gates. | High |
| 38 | Codex | `codex` | Code / memory | An ancient book of laws | The project's living code book. | High |
| 39 | Axiom | `axiom` | Precision / learning | A self-evident truth | Reliable coding principles and project rules. | High |
| 40 | Tenet | `tenet` | Principles / memory | A guiding principle | Project rules the agent remembers and follows. | High |
| 41 | Verity | `verity` | Precision / truth | Truth and verification | Code that can be trusted and verified. | High |
| 42 | Coda | `coda` | Code / endings | The concluding section | Finishes the plan with implemented code. | High |
| 43 | Sage | `sage` | Memory / learning | A wise advisor | Remembers project lore and advises. | High |
| 44 | Vane | `vane` | Direction | A weather vane | Points the right direction in the codebase. | High |
| 45 | Grist | `grist` | Systems / learning | Grain to be ground | Refines raw code and data into useful output. | High |

## Final shortlist

| Rank | Name | Command | Why it fits | Main risk |
|------|------|---------|-------------|-----------|
| 1 | **Tovyr** | `tovyr` | Already unique, memorable, and invested in the codebase; short, pronounceable, terminal-friendly. | Brand recognition still being established. |
| 2 | Kairo | `kairo` | Strong meaning (circuit / right moment); visually clean and 5 letters. | Existing Go terminal task manager and Kairo.js. |
| 3 | Chisel | `chisel` | Perfect metaphor for careful, diff-aware code editing. | Canonical Chisel and multiple AI-coding CLIs. |
| 4 | Zircon | `zircon` | Hard, brilliant, multifaceted; fits multi-provider reframing. | npm `zircon` static-site generator and Zirco toolchain. |
| 5 | Tilde | `tilde` | Directly at home in the terminal (`~`). | Tilde.run sandbox platform. |

## Recommendation

**Keep Tovyr.**

It is the only candidate with no meaningful collision in the AI-coding-agent CLI space, it already has a working npm package (`tovyrcode`), launcher scripts, docs, TUI brand assets, and a recognizable diamond icon. Rebranding to any of the alternatives would create unnecessary user confusion and a costly migration for a name that is not demonstrably stronger.

If the product must be renamed, **Kairo** is the best alternative: it is short, meaningful, and has the least severe collision set among the viable new names.
