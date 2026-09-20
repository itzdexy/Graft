import type { LocalJSXCommandCall } from '../../types/command.js'
import { formatAutoGptChain } from '../../services/graft/ecosystem/adapters/autogpt.js'

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const goal = args.trim()
  const sub = goal.split(/\s+/)[0]?.toLowerCase()

  if (!goal || sub === 'help' || sub === 'list') {
    onDone(
      `# AutoGPT chain\n\n${formatAutoGptChain()}\n\nStart: \`/chain start <goal>\` · Reflect: \`/reflect\``,
      { display: 'system' },
    )
    return null
  }

  if (sub === 'start') {
    const g = goal.slice('start'.length).trim() || 'complete the user goal'
    onDone(undefined, {
      shouldQuery: true,
      metaMessages: [
        [
            '# AutoGPT agent chain',
            '',
            formatAutoGptChain(),
            '',
            `## Goal`,
            g,
            '',
            'Begin at **Analyze**. Use `/reflect` before declaring done.',
        ].join('\n'),
      ],
    })
    return null
  }

  onDone(undefined, {
    shouldQuery: true,
    metaMessages: [
      [
          '# AutoGPT agent chain',
          '',
          formatAutoGptChain(),
          '',
          `## Goal`,
          goal,
          '',
          'Begin at **Analyze**; run `/reflect` after major milestones.',
      ].join('\n'),
    ],
  })
  return null
}
