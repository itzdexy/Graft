import type { LocalCommandCall } from '../../types/command.js'
import {
  AIDER_EDIT_FORMAT_REMINDER,
  aiderLintTestHint,
} from '../../services/blink/ecosystem/adapters/aider.js'
import { readPackageScripts } from '../../services/blink/ecosystem/lint/suggestLint.js'
import { loadRepoMapSectionSync } from '../../services/blink/repo/repoContext.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalCommandCall = async (args) => {
  const sub = args.trim().toLowerCase() || 'help'
  const cwd = getCwd()

  if (sub === 'format') {
    return { type: 'text', value: `# Aider edit format\n\n${AIDER_EDIT_FORMAT_REMINDER}` }
  }

  if (sub === 'map') {
    const map = loadRepoMapSectionSync(cwd)
    if (!map) {
      return {
        type: 'text',
        value:
          'Repo map not cached. Run `/repo analyze` or `/repo graph` first, then retry `/aider map`.',
      }
    }
    return { type: 'text', value: map }
  }

  if (sub === 'lint' || sub === 'test') {
    const scripts = readPackageScripts(cwd)
    const hint = aiderLintTestHint(scripts)
    return {
      type: 'text',
      value: [
        '# Aider lint/test hint',
        '',
        `Suggested commands: ${hint}`,
        '',
        'Run `/verify` or `/agent autofix` after edits.',
      ].join('\n'),
    }
  }

  return {
    type: 'text',
    value: [
      '# Aider adapter',
      '',
      '- `/aider format` — SEARCH/REPLACE block reminder',
      '- `/aider map` — cached repo map (Aider-style context)',
      '- `/aider lint` — project test/lint scripts',
      '- `/git-commit` — commit with blinkcode: prefix',
    ].join('\n'),
  }
}
