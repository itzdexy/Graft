import { isEnvTruthy } from '../../../utils/envUtils.js'
import { getCwd } from '../../../utils/cwd.js'
import { isTovyrRuntime } from '../../../utils/tovyrRuntime.js'

/** LSP guidance for Tovyr when ENABLE_LSP_TOOL is set. */
export function loadLspContextSection(): string | null {
  if (!isTovyrRuntime()) return null
  if (!isEnvTruthy(process.env.ENABLE_LSP_TOOL)) return null
  if (process.env.TOVYR_LSP_CONTEXT === '0') return null

  return [
    '# LSP context (language servers)',
    '',
    `CWD: ${getCwd()}`,
    '',
    'The LSP tool is enabled. Before large edits:',
    '- Use LSP go-to-definition and diagnostics on touched symbols.',
    '- Prefer fixing type/lint errors the server reports over guessing.',
    '- After Edit/Write, diagnostics refresh automatically when the LSP manager is active.',
    '',
    'Set ENABLE_LSP_TOOL=1 and configure language servers in project settings for full IDE-grade context.',
  ].join('\n')
}
