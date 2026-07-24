import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  buildWorktreePlan,
  formatWorktreeList,
  formatWorktreePlan,
  listWorktreePlans,
  saveWorktreePlan,
} from '../../services/blink/ecosystem/openhands/worktree.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const trimmed = args.trim()
  const cwd = getCwd()
  const [cmd, ...rest] = trimmed ? trimmed.split(/\s+/) : ['list']
  const arg = rest.join(' ').trim()

  if (!trimmed || cmd === 'list') {
    onDone(formatWorktreeList(cwd), { display: 'system' })
    return null
  }

  if (cmd === 'new') {
    if (!arg) {
      onDone('Usage: `/worktree new <name>`', { display: 'system' })
      return null
    }
    const plan = buildWorktreePlan(cwd, arg)
    saveWorktreePlan(cwd, plan)
    const cmdLine = plan.commands[0]!
    onDone(
      `${formatWorktreePlan(plan)}\n\n---\n\nSubmitting \`${cmdLine}\`…`,
      {
        display: 'system',
        nextInput: cmdLine,
        submitNextInput: true,
      },
    )
    return null
  }

  if (cmd === 'git') {
    const match = listWorktreePlans(cwd).find(p => p.id.startsWith(arg) || p.name === arg)
    if (!match) {
      onDone(`No worktree plan matching \`${arg}\`.`, { display: 'system' })
      return null
    }
    onDone(`Recreating worktree for **${match.name}**…`, {
      display: 'system',
      nextInput: match.commands[0]!,
      submitNextInput: true,
    })
    return null
  }

  onDone('Usage: `/worktree new <name>` · `list` · `git <id>`', { display: 'system' })
  return null
}
