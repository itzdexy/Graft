/**
 * Shared CLI UX — help text, global flags, exit codes, and output formatting.
 * Used by bin/blink.js and lightweight script subcommands.
 */
import { BLINK_VERSION, BLINK_PRODUCT_NAME } from '../constants/blink.js'

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
])

/**
 * Parse and strip global CLI flags. Sets process.env side effects.
 * @param {string[]} argv
 * @returns {{ argv: string[], quiet: boolean, verbose: boolean, debug: boolean, json: boolean }}
 */
export function parseGlobalCliFlags(argv) {
  const quiet = argv.includes('--quiet') || argv.includes('-q')
  const verbose = argv.includes('--verbose')
  const debug = argv.includes('--debug')
  const json = argv.includes('--json')

  if (quiet) process.env.BLINK_QUIET = '1'
  if (verbose) process.env.BLINK_VERBOSE = '1'
  if (debug) process.env.BLINK_DEBUG = '1'
  if (json) process.env.BLINK_JSON = '1'

  const cleaned = argv.filter(a => !GLOBAL_FLAGS.has(a))
  return { argv: cleaned, quiet, verbose, debug, json }
}

export function isQuiet() {
  return process.env.BLINK_QUIET === '1'
}

export function isVerbose() {
  return process.env.BLINK_VERBOSE === '1'
}

export function isJsonMode() {
  return process.env.BLINK_JSON === '1'
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
  console.log(`${BLINK_PRODUCT_NAME} v${BLINK_VERSION}
AI coding agent in your terminal.

Usage:
  blink [options]                 Start interactive session (default)
  blink ask <question>            One-shot answer
  blink review|fix|plan <scope>   Workflow one-shots (print mode)
  blink -p <prompt>               Print mode (scripting / pipes)
  blink sessions list             List resumable sessions for this project
  blink --resume <session-id>     Resume a saved session

Getting started:
  blink setup                     First-run checks (recommended after install)
  blink auth login --provider <id> --key <key>
                                  Connect your chosen provider
  blink config                    Show provider, model, and paths
  blink doctor                    Diagnose install issues
  blink bench [--live]            Score CLI quality (offline + optional API probes)

Providers:
  blink provider list             List providers and active model
  blink provider use <id>         Switch provider
  blink provider model <id>       Set model for active provider
  blink models [provider]         List models

Browser:
  blink chrome setup --extension-id <id>   Register Chrome extension
  blink chrome status                    Extension + native host status

Options:
  -h, --help           Show this help
  --version            Show version
  -q, --quiet          Suppress non-essential stderr
  --verbose            Detailed command output
  --debug              Enable debug logging
  --json               Machine-readable output (config, doctor, provider)
  --fast               Fast startup (default — skips heavy plugins)
  --full               Full mode: all plugins and MCP
  --chrome             Enable browser automation
  --allow-home         Allow launch from home directory (not recommended)
  --debug-to-stderr    Verbose startup logs on stderr

Examples:
  blink ask "summarize this repository"
  blink review "uncommitted changes"
  blink fix "failing unit tests"
  blink plan "add OAuth login"
  blink sessions list
  blink auth login --provider anthropic --key sk-ant-YOUR_KEY
  blink provider use ollama
  blink bench                     Offline benchmark scorecard
  blink bench --live              Include model latency/quality probes
  blink bench compare             Compare last two runs
  blink -p "add unit tests" --output-format json

In-app: /guide · /provider · /help · /plan · /review · /resume
Docs:   docs/GUIDE.md · docs/ROADMAP.md

Exit codes: 0 success · 1 error · 2 usage
`)
}

export function printDoctorHelp() {
  console.log(`Usage: blink doctor [options]
       blink setup  (alias — same checks, onboarding tone)

Verify install: PATH, Bun, API key, providers config, git, warm cache, dependencies.

Options:
  -h, --help     Show help
  -q, --quiet    Only print summary line
  --json         Machine-readable report
  --verbose      Show all check details (default)

Examples:
  blink setup
  blink doctor --json
`)
}

export function printSessionsHelp() {
  console.log(`Usage: blink sessions list [options]

List resumable sessions for the current project directory.

Options:
  -h, --help       Show help
  --limit=N        Max sessions (default 10)
  --json           Machine-readable output

Examples:
  blink sessions list
  blink --resume <session-id>
`)
}

export function printConfigHelp() {
  console.log(`Usage: blink config [options]

Show active provider, model, config paths, and saved keys.

Options:
  -h, --help     Show help
  --json         Machine-readable output

Examples:
  blink config
  blink config --json
`)
}

export function printProviderHelp() {
  console.log(`Usage: blink provider <command> [options]

Commands:
  list                    List providers (default)
  use <provider-id>       Switch active provider
  model <model-id>        Set model for active provider
  models [provider-id]    List models (alias: blink models)

Options:
  -h, --help     Show help
  --json         Machine-readable output

Examples:
  blink provider list
  blink provider use openrouter
  blink provider model anthropic/claude-sonnet-4
  blink models ollama
`)
}

export function printAuthLoginHelp() {
  console.log(`Usage: blink auth login [options]

Save an API key for a provider.

Options:
  --key <key>              API key (required)
  --provider <provider-id> Provider to save key for (default: active)

Examples:
  blink auth login --key fe_oa_YOUR_KEY
  blink auth login --provider anthropic --key sk-ant-...

Get a FreeModel key: https://freemodel.dev
`)
}

/** Friendly first-run block when setup finds missing API key. */
export function printFirstRunOnboarding() {
  console.log(`
Welcome to Blink — quick setup:

  1. Start Blink and choose your provider:
     blink

  2. Or connect one directly:
     blink auth login --provider anthropic --key YOUR_KEY

  3. Open any project folder and start:
     cd your-project
     blink

Use blink config to verify provider and model.
In-app help: /guide
`)
}
