/** Shared command-line help, flags, exit codes and output formatting. */
import { TOVYR_VERSION, TOVYR_PRODUCT_NAME, TOVYR_CLI_NAME } from '../src/constants/tovyr.js'

export const EXIT = { OK: 0, ERROR: 1, USAGE: 2 }
const GLOBAL_FLAGS = new Set(['--quiet', '-q', '--verbose', '--debug', '--json', '--export', '--no-tips'])
const command = TOVYR_CLI_NAME

/** Parse global flags while retaining existing internal environment keys. */
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
  const cleaned = argv.filter(arg => !GLOBAL_FLAGS.has(arg))
  return { argv: cleaned, quiet, verbose, debug, json, export: exportMode, noTips }
}

export function isQuiet() { return process.env.TOVYR_QUIET === '1' }
export function isVerbose() { return process.env.TOVYR_VERBOSE === '1' }
export function isJsonMode() { return process.env.TOVYR_JSON === '1' }
export function isExportMode() { return process.env.TOVYR_EXPORT === '1' }

export function cliNote(message) {
  if (!isQuiet()) console.error(message)
}
export function cliSuccess(message) { console.log(message) }

export function cliExit(code, payload) {
  if (isJsonMode() && payload) {
    const body = {
      ok: code === EXIT.OK,
      ...(payload.error ? { error: payload.error } : {}),
      ...(payload.message ? { message: payload.message } : {}),
      ...(payload.data !== undefined ? { data: payload.data } : {}),
    }
    const output = JSON.stringify(body, null, 2)
    if (code === EXIT.OK) console.log(output)
    else console.error(output)
  } else if (payload?.error) {
    console.error(payload.error)
  } else if (payload?.message && code === EXIT.OK) {
    console.log(payload.message)
  }
  process.exit(code)
}
export function cliUsage(message) { cliExit(EXIT.USAGE, { error: message }) }

export function printMainHelp() {
  console.log(`${TOVYR_PRODUCT_NAME} v${TOVYR_VERSION}
AI coding agent in your terminal.

Usage:
  ${command} [options]                 Start interactive session (default)
  ${command} ask <question>            One-shot answer
  ${command} review|fix|plan <scope>   Workflow one-shots (print mode)
  ${command} -p <prompt>               Print mode (scripting / pipes)
  ${command} sessions list             List resumable sessions for this project
  ${command} --resume <session-id>     Resume a saved session

Getting started:
  ${command} setup                     First-run checks
  ${command} auth login --provider <id> --key <key>
                                    Connect your chosen provider
  ${command} config                    Show provider, model, and paths
  ${command} doctor                    Diagnose install issues
  ${command} bench [--live]            Run CLI benchmarks

Providers:
  ${command} provider list             List providers and active model
  ${command} provider use <id>         Switch provider
  ${command} provider model <id>       Set model for active provider
  ${command} models [provider]         List models
  ${command} codex                     Choose a model and launch Codex
  ${command} chatgpt                   Open installed ChatGPT Desktop
  ${command} claude                    Choose a model and launch Claude Code
  ${command} launch <app>              Launch or show an app connection recipe
  ${command} apps list                 List supported apps
  ${command} apps status [app]         Check app discovery
  ${command} apps configure <app>      Show endpoint/model recipe
  ${command} apps doctor [app]         Print app diagnostics
  ${command} apps disconnect <app>     Remove managed app metadata
  ${command} apps restore <app>        Restore an app backup

Browser:
  ${command} chrome                    Browser integration status (not available yet)

Options:
  -h, --help             Show help
  --version              Show version
  -q, --quiet            Suppress non-essential stderr
  --verbose              Detailed command output
  --debug                Enable debug logging
  --json                 Machine-readable output where supported
  --fast                 Fast startup (default)
  --full                 Load all plugins and MCP
  --allow-home           Allow launch from home directory
  --debug-to-stderr      Verbose startup logs
  --no-tips              Suppress startup tips

Examples:
  ${command} ask "summarize this repository"
  ${command} review "uncommitted changes"
  ${command} fix "failing unit tests"
  ${command} plan "add OAuth login"
  ${command} sessions list
  ${command} auth login --provider anthropic --key YOUR_KEY
  ${command} provider use ollama
  ${command} apps list
  ${command} bench --live
  ${command} -p "add unit tests" --output-format json

In-app: /guide · /provider · /help · /plan · /review · /resume
Docs:   https://github.com/itzdexy/Graft

Exit codes: 0 success · 1 error · 2 usage
`)
}

export function printDoctorHelp() {
  console.log(`Usage: ${command} doctor [options]
       ${command} setup  (alias)

Verify install: PATH, Bun, API key, provider config, git, warm cache, dependencies, browser, MCP, permissions.

Options:
  -h, --help     Show help
  -q, --quiet    Only print summary line
  --json         Machine-readable report
  --export       Write a JSON report
  --verbose      Show all diagnostics

Examples:
  ${command} setup
  ${command} doctor --json
  ${command} doctor --export
`)
}

export function printSessionsHelp() {
  console.log(`Usage: ${command} sessions list [options]

List resumable sessions for the current project directory.

Options:
  -h, --help       Show help
  --limit=N        Max sessions (default 10)
  --json           Machine-readable output

Examples:
  ${command} sessions list
  ${command} --resume <session-id>
`)
}

export function printConfigHelp() {
  console.log(`Usage: ${command} config [options]

Show active provider, model, config paths, and saved keys.

Options:
  -h, --help     Show help
  --json         Machine-readable report

Examples:
  ${command} config
  ${command} config --json
`)
}

export function printProviderHelp() {
  console.log(`Usage: ${command} provider <command> [options]

Commands:
  list                    List providers (default)
  use <provider-id>       Switch active provider
  model <model-id>        Set model for active provider
  models [provider-id]    List models

Options:
  -h, --help     Show help
  --json         Machine-readable output

Examples:
  ${command} provider list
  ${command} provider use openrouter
  ${command} provider model anthropic/claude-sonnet-4
  ${command} models ollama
  ${command} codex --provider openrouter --model openai/gpt-5
  ${command} claude --provider anthropic --model claude-sonnet-5
`)
}

export function printAuthLoginHelp() {
  console.log(`Usage: ${command} auth login [options]

Connect Graft with an API key, or open an official account login.

Options:
  --key <key>              API key for a configured provider
  --provider <provider-id> Provider to save key for (default: active)

Examples:
  ${command} auth login --key YOUR_KEY
  ${command} auth login --provider anthropic --key YOUR_KEY
  ${command} auth login --provider codex
  ${command} auth login --provider gemini-cli
  ${command} auth login --provider claude-subscription

Get a FreeModel key: https://freemodel.dev
Account logins stay inside their official CLIs; Graft never copies their tokens.
`)
}

export function printFirstRunOnboarding() {
  console.log(`
Welcome to Graft — quick setup:

  1. Start Graft and choose your provider:
     ${command}

  2. Or connect one directly:
     ${command} auth login --provider anthropic --key YOUR_KEY

  3. Open any project folder and start:
     cd your-project
     ${command}

Use ${command} config to verify provider and model.
In-app help: /guide
`)
}
