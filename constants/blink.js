/** Blink CLI branding — shared by npm launcher scripts (no TypeScript build required). */
export const BLINK_CLI_NAME = 'blink'

/** User-facing shell command, e.g. `blink --resume <id>`. */
export function blinkCmd(args = '') {
  const trimmed = String(args).trim()
  return trimmed ? `${BLINK_CLI_NAME} ${trimmed}` : BLINK_CLI_NAME
}

export const BLINK_PRODUCT_NAME = 'Blink'

export const BLINK_VERSION = '1.0.0'

export const BLINK_TAGLINE =
  'AI coding agent in your terminal'

export const BLINK_PROVIDER_BASE_URL = 'https://cc.freemodel.dev'

export const BLINK_DEFAULT_MODEL = 'claude-sonnet-4-5'

export const BLINK_PROVIDER_NAME = 'FreeModel'

export const BLINK_PROVIDER_DOCS_URL = 'https://freemodel.dev'


/** Canonical GitHub repository (source, issues, docs links). */
export const BLINK_GITHUB_OWNER = 'itsdexy'
export const BLINK_GITHUB_REPO_NAME = 'BlinkCode'
export const BLINK_GITHUB_REPO = `${BLINK_GITHUB_OWNER}/${BLINK_GITHUB_REPO_NAME}`
export const BLINK_GITHUB_URL = `https://github.com/${BLINK_GITHUB_REPO}`
export const BLINK_GITHUB_CLONE_URL = `https://github.com/${BLINK_GITHUB_REPO}.git`
export const BLINK_GITHUB_ISSUES_URL = `${BLINK_GITHUB_URL}/issues`
export const BLINK_GUIDE_URL = `${BLINK_GITHUB_URL}/blob/main/docs/GUIDE.md`
export const BLINK_DOCS_BASE = BLINK_GUIDE_URL
export const BLINK_SHORT_WEB = BLINK_GITHUB_URL
export const BLINK_SHORT_DESKTOP = BLINK_GITHUB_URL

export const BLINK_PLAN_FILENAME = 'blinkplan.md'

export const BLINK_CRITIQUE_FILENAME = 'blink-critique.md'

export const BLINK_AGENT_DIR = 'agent'

/** VS Code / Cursor extension IDs that provide IDE integration (marketplace + aliases). */
export const BLINK_IDE_EXTENSION_IDS = [
  'anthropic.claude-code',
  'anthropic.claude-code-internal',
  'blink.blink',
  'freemodel.blink',
]

/**
 * IDE integration env: `BLINK_CODE_<NAME>` wins, then `CLAUDE_CODE_<NAME>`
 * (set by the VS Code / Cursor extension).
 */
export function getIdeEnv(name) {
  return (
    process.env[`BLINK_CODE_${name}`] ?? process.env[`CLAUDE_CODE_${name}`]
  )
}
