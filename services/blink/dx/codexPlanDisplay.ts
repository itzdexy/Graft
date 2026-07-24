/** Codex-style plan parsing for checklist UI (Updated Plan → [ ] steps). */

export type CodexPlanCheckItem = {
  text: string
  done: boolean
  /** First incomplete item is highlighted as active. */
  active?: boolean
}

export type CodexPlanDisplay = {
  title: string
  summary?: string
  items: CodexPlanCheckItem[]
}

const CHECKBOX_RE = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/
const BULLET_RE = /^\s*[-*]\s+(.+)$/
const NUMBERED_RE = /^\s*\d+[.)]\s+(.+)$/

/**
 * Parse plan markdown into Codex-style checklist rows.
 * Prefers `- [ ]` / `- [x]` tasks; falls back to bullets or numbered lines.
 */
export function parseCodexPlanDisplay(planMarkdown: string): CodexPlanDisplay {
  const lines = planMarkdown.split(/\r?\n/)
  const items: CodexPlanCheckItem[] = []
  let title = 'Updated Plan'
  let summary: string | undefined

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const heading = line.match(/^#{1,3}\s+(.+)$/)
    if (heading?.[1] && items.length === 0 && !summary) {
      title = heading[1].trim()
      continue
    }

    const checkbox = line.match(CHECKBOX_RE)
    if (checkbox) {
      items.push({
        text: checkbox[2]!.trim(),
        done: checkbox[1]!.toLowerCase() === 'x',
      })
      continue
    }

    const numbered = line.match(NUMBERED_RE)
    if (numbered?.[1]) {
      items.push({ text: numbered[1].trim(), done: false })
      continue
    }

    const bullet = line.match(BULLET_RE)
    if (bullet?.[1] && !line.startsWith('```')) {
      items.push({ text: bullet[1].trim(), done: false })
      continue
    }

    if (!summary && items.length === 0 && line.length > 20 && !line.startsWith('#')) {
      summary = line
    }
  }

  const firstOpen = items.findIndex(i => !i.done)
  if (firstOpen >= 0) {
    items[firstOpen] = { ...items[firstOpen]!, active: true }
  }

  return { title, summary, items }
}

/** Relabel plan-exit options to Codex-style Approve / Request changes. */
export function formatCodexApprovalLabel(label: string): string {
  const lower = label.toLowerCase()
  if (lower.startsWith('no')) return 'Request changes'
  if (lower.includes('ultraplan')) return label
  if (lower.startsWith('yes')) return 'Approve'
  return label
}
