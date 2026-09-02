/**
 * Shared CLI UX — help text, global flags, exit codes, and output formatting.
 * Used by bin/tovyr.js and lightweight script subcommands.
 */
import { TOVYR_VERSION, TOVYR_PRODUCT_NAME } from '../src/constants/tovyr.js'

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

  if (quiet) process.env.TOVYR_QUIET = '1'
  if (verbose) process.env.TOVYR_VERBOSE = '1'
  if (debug) process.env.TOVYR_DEBUG = '1'
  if (json) process.env.TOVYR_JSON = '1'
  if (exportMode) process.env.TOVYR_EXPORT = '1'
  if (noTips) process.env.TOVYR_NO_TIPS = '1'

  const cleaned = argv.filter(a => !GLOBAL_FLAGS.has(a))
  return { argv: cleaned, quiet, verbose, debug, json, export: exportMode, noTips }
}

export function isQuiet() {
  return process.env.TOVYR_QUIET === '1'
}

export function isVerbose() {
  return process.env.TOVYR_VERBOSE === '1'
}

export function isJsonMode() {
  return process.env.TOVYR_JSON === '1'
}

export function isExportMode() {
  return process.env.TOVYR_EXPORT === '1'
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
  console.log(`${TOVYR_PRODUCT_NAME} v${TOVYR_VERSION}
AI coding agent in your terminal.

Usage:
  tovyr [options]                 Start interactive session (default)
  tovyr ask <question>            One-shot answer
  tovyr review|fix|plan <scope>   Workflow one-shots (print mode)
  tovyr -p <prompt>               Print mode (scripting / pipes)
  tovyr sessions list             List resumable sessions for this project
  tovyr --resume <session-id>     Resume a saved session

Getting started:
  tovyr setup                     First-run checks (recommended after install)
  tovyr auth login --provider <id> --key <key>
                                  Connect your chosen provider
  tovyr config                    Show provider, model, and paths
  tovyr doctor                    Diagnose install issues
  tovyr bench [--live]            Score CLI quality (offline + optional API probes)

Providers:
  tovyr provider list             List providers and active model
  tovyr provider use <id>         Switch provider
  tovyr provider model <id>       Set model for active provider
  tovyr models [provider]         List models
  tovyr codex                     Choose a Tovyr model and launch Codex
  tovyr chatgpt                   Open installed ChatGPT Desktop for Tovyr models
  tovyr claude                    Choose a Tovyr model and launch Claude Code
  tovyr launch <app>              Launch or show the connection recipe for an app
  tovyr apps list                 List every supported app and readiness state
  tovyr apps status [app]         Check app discovery without launching anything
  tovyr apps configure <app>      Show a safe endpoint/model recipe
  tovyr apps doctor [app]         Print actionable app diagnostics
  tovyr apps disconnect <app>     Remove Tovyr-managed app metadata
  tovyr apps restore <app>        Restore the last recorded app backup

Browser:
  tovyr chrome                    Browser integration status (not available yet)

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
  --no-tips            Suppress startup tips (or set TOVYR_NO_TIPS=1)

Examples:
  tovyr ask "summarize this repository"
  tovyr review "uncommitted changes"
  tovyr fix "failing unit tests"
  tovyr plan "add OAuth login"
  tovyr sessions list
  tovyr auth login --provider anthropic --key sk-ant-YOUR_KEY
  tovyr provider use ollama
  tovyr apps list
  tovyr apps doctor claude-desktop
  tovyr bench                     Offline benchmark scorecard
  tovyr bench --live              Include model latency/quality probes
  tovyr bench compare             Compare last two runs
  tovyr -p "add unit tests" --output-format json

In-app: /guide · /provider · /help · /plan · /review · /resume
Docs:   docs/GUIDE.md · docs/ROADMAP.md

Exit codes: 0 success · 1 error · 2 usage
`)
}

export function printDoctorHelp() {
  console.log(`Usage: tovyr doctor [options]
       tovyr setup  (alias — same checks, onboarding tone)

Verify install: PATH, Bun, API key, providers config, git, warm cache, dependencies, browser, MCP, permissions.

Options:
  -h, --help     Show help
  -q, --quiet    Only print summary line
  --json         Machine-readable report
  --export       Write JSON report to tovyr-doctor-report-<timestamp>.json
  --verbose      Show all check details (default)

Examples:
  tovyr setup
  tovyr doctor --json
  tovyr doctor --export
`)}

export function printSessionsHelp() {
  console.log(`Usage: tovyr sessions list [options]

List resumable sessions for the current project directory.

Options:
  -h, --help       Show help
  --limit=N        Max sessions (default 10)
  --json           Machine-readable output

Examples:
  tovyr sessions list
  tovyr --resume <session-id>
`)
}

export function printConfigHelp() {
  console.log(`Usage: tovyr config [options]

Show active provider, model, config paths, and saved keys.

Options:
  -h, --help     Show help
  --json         Machine-readable output

Examples:
  tovyr config
  tovyr config --json
`)
}

export function printProviderHelp() {
  console.log(`Usage: tovyr provider <command> [options]

Commands:
  list                    List providers (default)
  use <provider-id>       Switch active provider
  model <model-id>        Set model for active provider
  models [provider-id]    List models (alias: tovyr models)

Options:
  -h, --help     Show help
  --json         Machine-readable output

Examples:
  tovyr provider list
  tovyr provider use openrouter
  tovyr provider model anthropic/claude-sonnet-4
  tovyr models ollama
  tovyr codex --provider openrouter --model openai/gpt-5
  tovyr claude --provider anthropic --model claude-sonnet-5
`)
}

export function printAuthLoginHelp() {
  console.log(`Usage: tovyr auth login [options]

Connect Tovyr with an API key, or open an official account login.

Options:
  --key <key>              API key for a Tovyr provider
  --provider <provider-id> Provider to save key for (default: active)

Examples:
  tovyr auth login --key fe_oa_YOUR_KEY
  tovyr auth login --provider anthropic --key sk-ant-...
  tovyr auth login --provider codex
  tovyr auth login --provider gemini-cli
  tovyr auth login --provider claude-subscription

Get a FreeModel key: https://freemodel.dev
Account logins stay inside their official CLIs; Tovyr never copies their tokens.
`)
}

/** Friendly first-run block when setup finds missing API key. */
export function printFirstRunOnboarding() {
  console.log(`
Welcome to Tovyr — quick setup:

  1. Start Tovyr and choose your provider:
     tovyr

  2. Or connect one directly:
     tovyr auth login --provider anthropic --key YOUR_KEY

  3. Open any project folder and start:
     cd your-project
     tovyr

Use tovyr config to verify provider and model.
In-app help: /guide
`)
}
