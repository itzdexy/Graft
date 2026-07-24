/** Blink CLI branding and provider defaults. */
export const BLINK_CLI_NAME = 'blink'

/** User-facing shell command, e.g. `blink --resume <id>`. */
export function blinkCmd(args = ''): string {
  const trimmed = args.trim()
  return trimmed ? `${BLINK_CLI_NAME} ${trimmed}` : BLINK_CLI_NAME
}

export const BLINK_PRODUCT_NAME = 'Blink'

/** Display version (independent of upstream blink runtime). */
export const BLINK_VERSION = '1.0.0'

export const BLINK_TAGLINE =
  'AI coding agent in your terminal'

/** Default FreeModel proxy base URL (official CC client endpoint). */
export const BLINK_PROVIDER_BASE_URL = 'https://cc.freemodel.dev'

/** Sensible default when using FreeModel (override with BLINK_DEFAULT_MODEL). */
export const BLINK_DEFAULT_MODEL = 'claude-sonnet-4-5'

export const BLINK_PROVIDER_NAME = 'FreeModel'

export const BLINK_PROVIDER_DOCS_URL = 'https://freemodel.dev'

export const BLINK_GITHUB_URL = 'https://github.com/itsdexy/BlinkCode'
export const BLINK_GITHUB_ISSUES_URL = `${BLINK_GITHUB_URL}/issues`
/** Canonical user guide (ships with the repo / npm package). */
export const BLINK_GUIDE_URL = `${BLINK_GITHUB_URL}/blob/main/docs/GUIDE.md`
export const BLINK_DOCS_BASE = BLINK_GUIDE_URL
export const BLINK_SHORT_WEB = BLINK_GITHUB_URL
export const BLINK_SHORT_DESKTOP = BLINK_GITHUB_URL

/** Plan file written in the project root during plan mode. */
export const BLINK_PLAN_FILENAME = 'blinkplan.md'

/** Transcript from multi-agent critique sessions (/critique, /multiagent). */
export const BLINK_CRITIQUE_FILENAME = 'blink-critique.md'

export const BLINK_AGENT_DIR = 'agent'

/** VS Code / Cursor extension IDs that provide IDE integration (marketplace + aliases). */
export const BLINK_IDE_EXTENSION_IDS = [
  'anthropic.claude-code',
  'anthropic.claude-code-internal',
  'blink.blink',
  'freemodel.blink',
] as const

/**
 * IDE integration env: `BLINK_CODE_<NAME>` wins, then `CLAUDE_CODE_<NAME>`
 * (set by the VS Code / Cursor extension).
 */
export function getIdeEnv(name: string): string | undefined {
  return (
    process.env[`BLINK_CODE_${name}`] ?? process.env[`CLAUDE_CODE_${name}`]
  )
}
