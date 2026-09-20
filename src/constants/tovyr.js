/** Shared product metadata. Keep the legacy export identifiers for existing imports. */
export const TOVYR_CLI_NAME = 'graft'

/** User-facing shell command, e.g. `graft --resume <id>`. */
export function tovyrCmd(args = '') {
  const trimmed = String(args).trim()
  return trimmed ? `${TOVYR_CLI_NAME} ${trimmed}` : TOVYR_CLI_NAME
}

export const TOVYR_PRODUCT_NAME = 'Graft'
export const TOVYR_VERSION = '1.4.0'
export const TOVYR_ICON = '◆'
export const TOVYR_TAGLINE = 'AI coding agent in your terminal'

export const TOVYR_PROVIDER_BASE_URL = 'https://cc.freemodel.dev'
export const TOVYR_DEFAULT_MODEL = 'claude-sonnet'
export const TOVYR_PROVIDER_NAME = 'FreeModel'
export const TOVYR_PROVIDER_DOCS_URL = 'https://freemodel.dev'

/** Canonical GitHub repository (source, issues, docs links). */
export const TOVYR_GITHUB_OWNER = 'itzdexy'
export const TOVYR_GITHUB_REPO_NAME = 'Graft'
export const TOVYR_GITHUB_REPO = `${TOVYR_GITHUB_OWNER}/${TOVYR_GITHUB_REPO_NAME}`
export const TOVYR_GITHUB_URL = `https://github.com/${TOVYR_GITHUB_REPO}`
export const TOVYR_GITHUB_CLONE_URL = `https://github.com/${TOVYR_GITHUB_REPO}.git`
export const TOVYR_GITHUB_ISSUES_URL = `${TOVYR_GITHUB_URL}/issues`
export const TOVYR_GUIDE_URL = `${TOVYR_GITHUB_URL}/blob/main/docs/GUIDE.md`
export const TOVYR_DOCS_BASE = TOVYR_GUIDE_URL
export const TOVYR_SHORT_WEB = TOVYR_GITHUB_URL
export const TOVYR_SHORT_DESKTOP = TOVYR_GITHUB_URL

export const TOVYR_PLAN_FILENAME = 'graftplan.md'
export const TOVYR_CRITIQUE_FILENAME = 'graft-critique.md'
export const TOVYR_AGENT_DIR = 'agent'

/** Existing extension IDs are retained for backwards-compatible IDE detection. */
export const TOVYR_IDE_EXTENSION_IDS = [
  'itsdexy.tovyr-code',
  'itsdexy.tovyr-code-internal',
  'tovyr.tovyr',
  'freemodel.tovyr',
]

/** Keep existing environment variable names until config migration is implemented. */
export function getIdeEnv(name) {
  return process.env[`TOVYR_CODE_${name}`] ?? process.env[`TOVYR_CODE_${name}`]
}
