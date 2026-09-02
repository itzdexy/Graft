import type { LocalJSXCommandCall } from '../../types/command.js'
import { formatAutoGptChain } from '../../services/tovyr/ecosystem/adapters/autogpt.js'

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const focus = args.trim() || 'the last task you worked on'
  onDone(undefined, {
    shouldQuery: true,
    metaMessages: [
      [
          '# AutoGPT — Reflect phase',
          '',
          `Reflect on: ${focus}`,
          '',
          '## Chain (for context)',
          formatAutoGptChain(),
          '',
          '## Do now',
          '1. Compare actual output vs stated success criteria.',
          '2. List gaps, regressions, or missing verification.',
          '3. Propose the **smallest** next action (fix, test, or `/agent autofix`).',
          '4. Do not start unrelated work.',
      ].join('\n'),
    ],
  })
  return null
}
