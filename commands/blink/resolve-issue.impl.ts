import type { LocalJSXCommandCall } from '../../types/command.js'
import { buildOpenHandsIssueResolverPrompt } from '../../services/blink/ecosystem/adapters/openhands.js'

const ISSUE_URL_RE =
  /https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)/i
const SHORT_RE = /^([^/\s]+)\/([^#\s]+)#(\d+)$/

function parseIssueArg(raw: string): {
  owner: string
  repo: string
  number: number
  url: string
} | null {
  const trimmed = raw.trim()
  const urlMatch = trimmed.match(ISSUE_URL_RE)
  if (urlMatch) {
    return {
      owner: urlMatch[1]!,
      repo: urlMatch[2]!,
      number: Number(urlMatch[3]),
      url: trimmed,
    }
  }
  const short = trimmed.match(SHORT_RE)
  if (short) {
    const owner = short[1]!
    const repo = short[2]!
    const number = Number(short[3])
    return {
      owner,
      repo,
      number,
      url: `https://github.com/${owner}/${repo}/issues/${number}`,
    }
  }
  return null
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const parsed = parseIssueArg(args)
  if (!parsed) {
    onDone(
      [
        'Usage: `/resolve-issue <github-issue-url>`',
        '       `/resolve-issue owner/repo#123`',
        '',
        'Starts the OpenHands reproduce → fix → verify workflow.',
      ].join('\n'),
      { display: 'system' },
    )
    return null
  }

  onDone(undefined, {
    shouldQuery: true,
    metaMessages: [
      {
        type: 'text',
        text: buildOpenHandsIssueResolverPrompt({
          number: parsed.number,
          title: `GitHub issue #${parsed.number}`,
          body: `Source: ${parsed.url}\n\nFetch issue details with \`gh issue view ${parsed.number}\` or WebFetch, then implement the fix.`,
          repo: `${parsed.owner}/${parsed.repo}`,
        }),
      },
    ],
  })
  return null
}
