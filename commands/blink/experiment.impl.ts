import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  formatExperimentForkList,
  formatExperimentStatus,
  getActiveExperimentFork,
  listExperimentForks,
  saveExperimentFork,
  setActiveExperimentFork,
  suggestExperimentGitBranch,
} from '../../services/blink/ecosystem/opencode/forkStore.js'
import { formatOpencodeForkBanner } from '../../services/blink/ecosystem/adapters/opencode.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const trimmed = args.trim()
  const cwd = getCwd()
  const [cmd, ...rest] = trimmed ? trimmed.split(/\s+/) : ['list']
  const arg = rest.join(' ').trim()

  if (!trimmed || cmd === 'list') {
    onDone(formatExperimentForkList(cwd), { display: 'system' })
    return null
  }

  if (cmd === 'status') {
    onDone(formatExperimentStatus(cwd), { display: 'system' })
    return null
  }

  if (cmd === 'new') {
    if (!arg) {
      onDone('Usage: `/experiment new <label>`', { display: 'system' })
      return null
    }
    const meta = saveExperimentFork(cwd, arg)
    const branch = suggestExperimentGitBranch(meta)
    onDone(
      [
        '# OpenCode experiment fork created',
        '',
        formatOpencodeForkBanner(meta),
        '',
        `Suggested git branch: \`${branch}\``,
        '',
        'Submitting `git checkout -b …` (edit if branch exists)…',
      ].join('\n'),
      {
        display: 'system',
        nextInput: `git checkout -b ${branch}`,
        submitNextInput: true,
      },
    )
    return null
  }

  if (cmd === 'git') {
    const active = getActiveExperimentFork(cwd)
    if (!active) {
      onDone('No active fork. Run `/experiment new <label>` first.', { display: 'system' })
      return null
    }
    const branch = suggestExperimentGitBranch(active)
    onDone(
      `Creating branch \`${branch}\` for fork **${active.label}**…`,
      {
        display: 'system',
        nextInput: `git checkout -b ${branch}`,
        submitNextInput: true,
      },
    )
    return null
  }

  if (cmd === 'use') {
    if (!arg) {
      onDone('Usage: `/experiment use <forkId-prefix>`', { display: 'system' })
      return null
    }
    const match = listExperimentForks(cwd).find(f => f.forkId.startsWith(arg))
    if (!match) {
      onDone(`No fork matching \`${arg}\`.`, { display: 'system' })
      return null
    }
    setActiveExperimentFork(cwd, match.forkId)
    onDone(formatExperimentStatus(cwd), { display: 'system' })
    return null
  }

  onDone(
    'Usage: `/experiment new <label>` · `list` · `status` · `git` · `use <forkId>`',
    { display: 'system' },
  )
  return null
}
