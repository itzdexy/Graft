/** GRAFT CLI branding — shared by npm launcher scripts (no TypeScript build required). */
export const GRAFT_CLI_NAME = 'graft'

/** User-facing shell command, e.g. `graft --resume <id>`. */
export function graftCmd(args = '') {
  const trimmed = String(args).trim()
  return trimmed ? `${GRAFT_CLI_NAME} ${trimmed}` : GRAFT_CLI_NAME
}

export const GRAFT_PRODUCT_NAME = 'Graft'
export const GRAFT_VERSION = '1.4.0'
export const GRAFT_ICON = '◆'

export const GRAFT_TAGLINE =
  'AI coding agent in your terminal'

export const GRAFT_PROVIDER_BASE_URL = 'https://cc.freemodel.dev'
export const GRAFT_DEFAULT_MODEL = 'claude-sonnet'
export const GRAFT_PROVIDER_NAME = 'FreeModel'
export const GRAFT_PROVIDER_DOCS_URL = 'https://freemodel.dev'

/** Canonical GitHub repository (source, issues, docs links). */
export const GRAFT_GITHUB_OWNER = 'itzdexy'
export const GRAFT_GITHUB_REPO_NAME = 'Graft'
export const GRAFT_GITHUB_REPO = `${GRAFT_GITHUB_OWNER}/${GRAFT_GITHUB_REPO_NAME}`
export const GRAFT_GITHUB_URL = `https://github.com/${GRAFT_GITHUB_REPO}`
export const GRAFT_GITHUB_CLONE_URL = `https://github.com/${GRAFT_GITHUB_REPO}.git`
export const GRAFT_GITHUB_ISSUES_URL = `${GRAFT_GITHUB_URL}/issues`
export const GRAFT_GUIDE_URL = `${GRAFT_GITHUB_URL}/blob/main/docs/GUIDE.md`
export const GRAFT_DOCS_BASE = GRAFT_GUIDE_URL
export const GRAFT_SHORT_WEB = GRAFT_GITHUB_URL
export const GRAFT_SHORT_DESKTOP = GRAFT_GITHUB_URL

export const GRAFT_PLAN_FILENAME = 'graftplan.md'
export const GRAFT_CRITIQUE_FILENAME = 'graft-critique.md'
export const GRAFT_AGENT_DIR = 'agent'

/** VS Code / Cursor extension IDs that provide IDE integration (marketplace + aliases). */
export const GRAFT_IDE_EXTENSION_IDS = [
  'itsdexy.graft-code',
  'itsdexy.graft-code-internal',
  'graft.graft',
  'freemodel.graft',
]

/**
 * IDE integration env: `GRAFT_CODE_<NAME>` wins, then `GRAFT_CODE_<NAME>`
 * (set by the VS Code / Cursor / IDE extension).
 */
export function getIdeEnv(name) {
  return (
    process.env[`GRAFT_CODE_${name}`] ?? process.env[`GRAFT_CODE_${name}`]
  )
}
