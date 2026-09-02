/** TOVYR CLI branding — shared by npm launcher scripts (no TypeScript build required). */
export const TOVYR_CLI_NAME = 'tovyr'

/** User-facing shell command, e.g. `tovyr --resume <id>`. */
export function tovyrCmd(args = '') {
  const trimmed = String(args).trim()
  return trimmed ? `${TOVYR_CLI_NAME} ${trimmed}` : TOVYR_CLI_NAME
}

export const TOVYR_PRODUCT_NAME = 'Tovyr'
export const TOVYR_VERSION = '1.3.6'
export const TOVYR_ICON = '◆'

export const TOVYR_TAGLINE =
  'AI coding agent in your terminal'

export const TOVYR_PROVIDER_BASE_URL = 'https://cc.freemodel.dev'
export const TOVYR_DEFAULT_MODEL = 'claude-sonnet'
export const TOVYR_PROVIDER_NAME = 'FreeModel'
export const TOVYR_PROVIDER_DOCS_URL = 'https://freemodel.dev'

/** Canonical GitHub repository (source, issues, docs links). */
export const TOVYR_GITHUB_OWNER = 'itsdexy'
export const TOVYR_GITHUB_REPO_NAME = 'Tovyr'
export const TOVYR_GITHUB_REPO = `${TOVYR_GITHUB_OWNER}/${TOVYR_GITHUB_REPO_NAME}`
export const TOVYR_GITHUB_URL = `https://github.com/${TOVYR_GITHUB_REPO}`
export const TOVYR_GITHUB_CLONE_URL = `https://github.com/${TOVYR_GITHUB_REPO}.git`
export const TOVYR_GITHUB_ISSUES_URL = `${TOVYR_GITHUB_URL}/issues`
export const TOVYR_GUIDE_URL = `${TOVYR_GITHUB_URL}/blob/main/docs/GUIDE.md`
export const TOVYR_DOCS_BASE = TOVYR_GUIDE_URL
export const TOVYR_SHORT_WEB = TOVYR_GITHUB_URL
export const TOVYR_SHORT_DESKTOP = TOVYR_GITHUB_URL

export const TOVYR_PLAN_FILENAME = 'tovyrplan.md'
export const TOVYR_CRITIQUE_FILENAME = 'tovyr-critique.md'
export const TOVYR_AGENT_DIR = 'agent'

/** VS Code / Cursor extension IDs that provide IDE integration (marketplace + aliases). */
export const TOVYR_IDE_EXTENSION_IDS = [
  'itsdexy.tovyr-code',
  'itsdexy.tovyr-code-internal',
  'tovyr.tovyr',
  'freemodel.tovyr',
]

/**
 * IDE integration env: `TOVYR_CODE_<NAME>` wins, then `TOVYR_CODE_<NAME>`
 * (set by the VS Code / Cursor / IDE extension).
 */
export function getIdeEnv(name) {
  return (
    process.env[`TOVYR_CODE_${name}`] ?? process.env[`TOVYR_CODE_${name}`]
  )
}
