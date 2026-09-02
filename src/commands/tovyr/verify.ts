import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { verifyPromptForCwd } from '../../services/tovyr/verify/verifyPrompts.js'
import { getCwd } from '../../utils/cwd.js'

function parseVerifyArgs(args: string): { kinds: string; help: boolean } {
  const trimmed = args.trim()
  if (!trimmed || trimmed === 'help' || trimmed === '?') {
    return { kinds: '', help: true }
  }
  return { kinds: trimmed, help: false }
}

const verify: Command = {
  type: 'prompt',
  name: 'verify',
  description: 'Run test, lint, typecheck, and build — analyze failures',
  argumentHint: '[test|lint|build|typecheck]',
  progressMessage: 'running verification',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const { kinds, help } = parseVerifyArgs(args)
    if (help) {
      return [
        {
          type: 'text',
          text: [
            '# Tovyr Verify',
            '',
            'Runs project test/lint/typecheck/build commands detected from package.json (or Cargo/go).',
            '',
            '- `/verify` — run all detected checks',
            '- `/verify test` — tests only',
            '- `/verify lint,test` — subset',
            '',
            'Pair with `/agent autofix` for Read → Edit → Verify loops.',
            'Aider-style: after edits run `/verify` when package scripts exist.',
            'Use `/code` for auto-accepted edits or `/bypass` for full auto-accept.',
          ].join('\n'),
        },
      ]
    }
    return verifyPromptForCwd(getCwd(), kinds || undefined)
  },
}

export default verify
