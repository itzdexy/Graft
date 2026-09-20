/**
 * Shared CLI UX — help text, global flags, exit codes, and output formatting.
 * Used by bin/graft.js and lightweight script subcommands.
 */
import { GRAFT_VERSION, GRAFT_PRODUCT_NAME } from '../src/constants/graft.js'

/** Exit codes (documented in README / GUIDE). */
export const EXIT = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
}

const GLOBAL_FLAGS = new Set([
  '--quiet',
  '-q',
  '--verbose',
  '--debug',
  '--json',
  '--export',
  '--no-tips',
])

/**
 * Parse and strip global CLI flags. Sets process.env side effects.
 * @param {string[]} argv
 * @returns {{ argv: string[], quiet: boolean, verbose: boolean, debug: boolean, json: boolean, export: boolean, noTips: boolean }}
 */
export function parseGlobalCliFlags(argv) {
  const quiet = argv.includes('--quiet') || argv.includes('-q')
  const verbose = argv.includes('--verbose')
  const debug = argv.includes('--debug')
  const json = argv.includes('--json')
  const exportMode = argv.includes('--export')
  const noTips = argv.includes('--no-tips')

  if (quiet) process.env.GRAFT_QUIET = '1'
  if (verbose) process.env.GRAFT_VERBOSE = '1'
  if (debug) process.env.GRAFT_DEBUG = '1'
  if (json) process.env.GRAFT_JSON = '1'
  if (exportMode) process.env.GRAFT_EXPORT = '1'
  if (noTips) process.env.GRAFT_NO_TIPS = '1'

  const cleaned = argv.filter(a => !GLOBAL_FLAGS.has(a))
  return { argv: cleaned, quiet, verbose, debug, json, export: exportMode, noTips }
}

export function isQuiet() {
  return process.env.GRAFT_QUIET === '1'
}

export function isVerbose() {
  return process.env.GRAFT_VERBOSE === '1'
}

export function isJsonMode() {
  return process.env.GRAFT_JSON === '1'
}

export function isExportMode() {
  return process.env.GRAFT_EXPORT === '1'
}

/** Write to stderr unless --quiet. */
export function cliNote(message) {
  if (isQuiet()) return
  console.error(message)
}

/** Success line to stdout (human mode). */
export function cliSuccess(message) {
  console.log(message)
}

/**
 * Exit with optional JSON envelope for scripting.
 * @param {number} code
 * @param {{ error?: string, message?: string, data?: unknown }} [payload]
 */
export function cliExit(code, payload) {
  if (isJsonMode() && payload) {
    const body = {
      ok: code === EXIT.OK,
      ...(payload.error ? { error: payload.error } : {}),
      ...(payload.message ? { message: payload.message } : {}),
      ...(payload.data !== undefined ? { data: payload.data } : {}),
    }
    if (code === EXIT.OK) {
      console.log(JSON.stringify(body, null, 2))
    } else {
      console.error(JSON.stringify(body, null, 2))
    }
  } else if (payload?.error) {
    console.error(payload.error)
  } else if (payload?.message && code === EXIT.OK) {
    console.log(payload.message)
  }
  process.exit(code)
}

export function cliUsage(message) {
  cliExit(EXIT.USAGE, { error: message })
}

export function printMainHelp() {
  console.log(`${GRAFT_PRODUCT_NAME} v${GRAFT_VERSION}
AI coding agent in your terminal.

Usage:
  graft [options]                 Start interactive session (default)
  graft ask <question>            One-shot answer
  graft review|fix|plan <scope>   Workflow one-shots (print mode)
  graft -p <prompt>               Print mode (scripting / pipes)
  graft sessions list             List resumable sessions for this project
  graft --resume <session-id>     Resume a saved session

Getting started:
  graft setup                     First-run checks (recommended after install)
  graft auth login --provider <id> --key <key>
                                  Connect your chosen provider
  graft config                    Show provider, model, and paths
  graft doctor                    Diagnose install issues
  graft bench [--live]            Score CLI quality (offline + optional API probes)

Providers:
  graft provider list             List providers and active model
  graft provider use <id>         Switch provider
  graft provider model <id>       Set model for active provider
  graft models [provider]         List models
  graft codex                     Choose a Graft model and launch Codex
  graft chatgpt                   Open installed ChatGPT Desktop for Graft models
  graft claude                    Choose a Graft model and launch Claude Code
  graft launch <app>              Launch or show the connection recipe for an app
  graft apps list                 List every supported app and readiness state
  graft apps status [app]         Check app discovery without launching anything
  graft apps configure <app>      Show a safe endpoint/model recipe
  graft apps doctor [app]         Print actionable app diagnostics
  graft apps disconnect <app>     Remove Graft-managed app metadata
  graft apps restore <app>        Restore the last recorded app backup

Browser:
  graft chrome                    Browser integration status (not available yet)

Options:
  -h, --help           Show this help
  --version            Show version
  -q, --quiet          Suppress non-essential stderr
  --verbose            Detailed command output
  --debug              Enable debug logging
  --json               Machine-readable output (config, doctor, provider)
  --fast               Fast startup (default — skips heavy plugins)
  --full               Full mode: all plugins and MCP
  --allow-home         Allow launch from home directory (not recommended)
  --debug-to-stderr    Verbose startup logs on stderr
  --no-tips            Suppress startup tips (or set GRAFT_NO_TIPS=1)

Examples:
  graft ask "summarize this repository"
  graft review "uncommitted changes"
  graft fix "failing unit tests"
  graft plan "add OAuth login"
  graft sessions list
  graft auth login --provider anthropic --key sk-ant-YOUR_KEY
  graft provider use ollama
  graft apps list
  graft apps doctor claude-desktop
  graft bench                     Offline benchmark scorecard
  graft bench --live              Include model latency/quality probes
  graft bench compare             Compare last two runs
  graft -p "add unit tests" --output-format json

In-app: /guide · /provider · /help · /plan · /review · /resume
Docs:   docs/GUIDE.md · docs/ROADMAP.md

Exit codes: 0 success · 1 error · 2 usage
`)
}

export function printDoctorHelp() {
  console.log(`Usage: graft doctor [options]
       graft setup  (alias — same checks, onboarding tone)

Verify install: PATH, Bun, API key, providers config, git, warm cache, dependencies, browser, MCP, permissions.

Options:
  -h, --help     Show help
  -q, --quiet    Only print summary line
  --json         Machine-readable report
  --export       Write JSON report to graft-doctor-report-<timestamp>.json
  --verbose      Show all check details (default)

Examples:
  graft setup
  graft doctor --json
  graft doctor --export
`)}

export function printSessionsHelp() {
  console.log(`Usage: graft sessions list [options]

List resumable sessions for the current project directory.

Options:
  -h, --help       Show help
  --limit=N        Max sessions (default 10)
  --json           Machine-readable output

Examples:
  graft sessions list
  graft --resume <session-id>
`)
}

export function printConfigHelp() {
  console.log(`Usage: graft config [options]

Show active provider, model, config paths, and saved keys.

Options:
  -h, --help     Show help
  --json         Machine-readable output

Examples:
  graft config
  graft config --json
`)
}

export function printProviderHelp() {
  console.log(`Usage: graft provider <command> [options]

Commands:
  list                    List providers (default)
  use <provider-id>       Switch active provider
  model <model-id>        Set model for active provider
  models [provider-id]    List models (alias: graft models)

Options:
  -h, --help     Show help
  --json         Machine-readable output

Examples:
  graft provider list
  graft provider use openrouter
  graft provider model anthropic/claude-sonnet-4
  graft models ollama
  graft codex --provider openrouter --model openai/gpt-5
  graft claude --provider anthropic --model claude-sonnet-5
`)
}

export function printAuthLoginHelp() {
  console.log(`Usage: graft auth login [options]

Connect Graft with an API key, or open an official account login.

Options:
  --key <key>              API key for a Graft provider
  --provider <provider-id> Provider to save key for (default: active)

Examples:
  graft auth login --key fe_oa_YOUR_KEY
  graft auth login --provider anthropic --key sk-ant-...
  graft auth login --provider codex
  graft auth login --provider gemini-cli
  graft auth login --provider claude-subscription

For example, FreeModel keys are available at: https://freemodel.dev
Account logins stay inside their official CLIs; Graft never copies their tokens.
`)
}

/** Friendly first-run block when setup finds missing API key. */
export function printFirstRunOnboarding() {
  console.log(`
Welcome to Graft — quick setup:

  1. Start Graft and choose your provider:
     graft

  2. Or connect one directly:
     graft auth login --provider anthropic --key YOUR_KEY

  3. Open any project folder and start:
     cd your-project
     graft

Use graft config to verify provider and model.
In-app help: /guide
`)
}
