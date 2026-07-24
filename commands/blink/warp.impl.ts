import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  buildWarpRunPrompt,
  formatWarpRunPreview,
  planWarpBlocks,
} from '../../services/blink/ecosystem/warp/runBlocks.js'

let lastWarpPaste = ''

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const trimmed = args.trim()
  const [cmd, ...rest] = trimmed ? trimmed.split(/\s+/) : ['help']
  const body = rest.join(' ').trim()

  if (!trimmed || cmd === 'help') {
    onDone(
      [
        '# Warp command blocks',
        '',
        '- `/warp preview` — then paste multi-line shell (blank lines separate blocks)',
        '- `/warp run <paste>` — execute blocks via agent',
        '- Multi-line pastes in prompts auto-enrich (Gemini/Warp enrich)',
      ].join('\n'),
      { display: 'system' },
    )
    return null
  }

  if (cmd === 'preview') {
    const paste = body || lastWarpPaste
    if (!paste) {
      onDone('Paste shell commands after `preview` or in the next message.', {
        display: 'system',
      })
      return null
    }
    lastWarpPaste = paste
    onDone(formatWarpRunPreview(planWarpBlocks(paste)), { display: 'system' })
    return null
  }

  if (cmd === 'run') {
    const paste = body.replace(/^--last\s*/, '') || lastWarpPaste
    if (!paste) {
      onDone('Usage: `/warp run <multi-line shell>`', { display: 'system' })
      return null
    }
    lastWarpPaste = paste
    const plan = planWarpBlocks(paste)
    if (!plan.blocks.length) {
      onDone('No blocks parsed.', { display: 'system' })
      return null
    }
    onDone(undefined, {
      shouldQuery: true,
      metaMessages: [{ type: 'text', text: buildWarpRunPrompt(plan.blocks) }],
    })
    return null
  }

  const plan = planWarpBlocks(trimmed)
  if (plan.blocks.length >= 2) {
    lastWarpPaste = trimmed
    onDone(formatWarpRunPreview(plan), { display: 'system' })
    return null
  }

  onDone('Usage: `/warp preview <paste>` · `/warp run <paste>`', { display: 'system' })
  return null
}
