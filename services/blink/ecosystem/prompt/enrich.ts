import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { expandGeminiFileContext, parseGeminiAtMentions } from '../adapters/gemini-cli.js'
import { buildOpenHandsIssueResolverPrompt } from '../adapters/openhands.js'
import {
  formatWarpBlocksForAgent,
  parseWarpCommandBlocks,
} from '../adapters/warp.js'
import { enrichExpansionPrompt } from '../../expansion/promptEnrichment.js'

const GITHUB_ISSUE_RE =
  /https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)/gi

export type PromptEnrichment = {
  blocks: ContentBlockParam[]
  notes: string[]
}

function extractGithubIssues(text: string): Array<{
  owner: string
  repo: string
  number: number
  url: string
}> {
  const out: Array<{ owner: string; repo: string; number: number; url: string }> = []
  for (const m of text.matchAll(GITHUB_ISSUE_RE)) {
    out.push({
      owner: m[1]!,
      repo: m[2]!,
      number: Number(m[3]),
      url: m[0]!,
    })
  }
  return out
}

const URL_RE = /https?:\/\/[^\s<>)"]+/gi

export function extractUrlsFromText(text: string): string[] {
  return [...new Set((text.match(URL_RE) ?? []).map(u => u.replace(/[.,;]+$/, '')))]
}

/**
 * Gemini @files, Warp multi-command pastes, GitHub issue URLs — enrich plain prompts.
 */
export function enrichBlinkPrompt(text: string, cwd: string): PromptEnrichment {
  const blocks: ContentBlockParam[] = []
  const notes: string[] = []

  const atPaths = parseGeminiAtMentions(text, cwd)
  if (atPaths.length > 0) {
    const ctx = expandGeminiFileContext(atPaths, { maxCharsPerFile: 6_000 })
    blocks.push({
      type: 'text',
      text: ['# Attached @file context (Gemini CLI-style)', '', ctx].join('\n'),
    })
    notes.push(`Expanded ${atPaths.length} @file mention(s)`)
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim()).length
  if (lines >= 4 && text.includes('\n')) {
    const warpBlocks = parseWarpCommandBlocks(text)
    if (warpBlocks.length >= 2) {
      blocks.push({
        type: 'text',
        text: [
          '# Multi-command paste (Warp-style blocks)',
          'Run each block in order; confirm destructive steps.',
          '',
          formatWarpBlocksForAgent(warpBlocks),
        ].join('\n'),
      })
      notes.push(`Parsed ${warpBlocks.length} Warp command blocks`)
    }
  }

  const issues = extractGithubIssues(text)
  if (issues.length === 1) {
    const i = issues[0]!
    blocks.push({
      type: 'text',
      text: buildOpenHandsIssueResolverPrompt({
        number: i.number,
        title: `GitHub issue #${i.number}`,
        body: `Source: ${i.url}\n\nFetch issue details with gh or WebFetch, then follow the OpenHands resolver workflow.`,
        repo: `${i.owner}/${i.repo}`,
      }),
    })
    notes.push('OpenHands issue resolver prepended')
  }

  const urls = extractUrlsFromText(text)
  if (urls.length > 0 && urls.length <= 5 && atPaths.length === 0) {
    blocks.push({
      type: 'text',
      text: [
        '# URLs in goal',
        'Use WebFetch on these before answering (do not print tool tokens):',
        ...urls.map(u => `- ${u}`),
      ].join('\n'),
    })
    notes.push(`${urls.length} URL(s) flagged for WebFetch`)
  }

  const expansion = enrichExpansionPrompt(text, cwd, process.env.BLINK_SESSION_ID ?? 'default')
  blocks.push(...expansion.blocks)
  notes.push(...expansion.notes)

  return { blocks, notes }
}

export function formatEnrichmentBanner(notes: string[]): string | null {
  if (!notes.length) return null
  return `Ecosystem: ${notes.join(' · ')}`
}
