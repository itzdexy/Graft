export type WebToolResultLike = {
  action: string
  output: string
  activity?: {
    operation: 'search' | 'read' | 'browse'
    query?: string
    sourceHost?: string
    resultCount?: number
    sourceHosts?: string[]
  }
}

export type WebToolResultPresentation = {
  summary: string
  detail: string
  truncated: boolean
}

export type ToolErrorPresentation = {
  summary: string
  detail: string
}

function bounded(text: string, max: number): { text: string; truncated: boolean } {
  const normalized = text.trim()
  if (normalized.length <= max) return { text: normalized, truncated: false }
  return { text: `${normalized.slice(0, max).trimEnd()}…`, truncated: true }
}

/** Facts-only web result projection shared by compact and expanded rows. */
export function projectWebToolResult(
  result: WebToolResultLike,
  maxDetailCharacters = 2_400,
): WebToolResultPresentation {
  const activity = result.activity
  const parts: string[] = []
  if (activity?.resultCount !== undefined) {
    parts.push(
      `${activity.resultCount} result${activity.resultCount === 1 ? '' : 's'}`,
    )
  }
  if (activity?.sourceHost) parts.push(activity.sourceHost)
  if (activity?.sourceHosts?.length) parts.push(activity.sourceHosts.join(', '))
  const firstLine = result.output.split(/\r?\n/).find(line => line.trim())?.trim()
  const summary = parts.join(' · ') || firstLine || `${result.action} complete`
  const detail = bounded(result.output, Math.max(160, maxDetailCharacters))
  return { summary, detail: detail.text, truncated: detail.truncated }
}

/**
 * Sentences a tool result addresses to the *model* — recovery instructions,
 * retry policy, enumerations of valid inputs. They belong in the tool result the
 * model reads, never in the transcript: shipping them to the user turns a
 * one-line failure into a wall of prompt engineering.
 */
const MODEL_STEERING_SENTENCE_RE =
  /(?:^|\s)(?:this is a recoverable[^.]*\.|do not retry[^.]*\.|answer the user directly[^.]*\.|retry with[^.]*\.|use one of[^.]*\.)/gi
/** Trailing enumerations ("Available skills: a, b, c.") exist to re-steer the model. */
const MODEL_STEERING_LIST_RE =
  /(?:^|\s)(?:available|valid|known|supported)\s+(?:skills|tools|agents|commands|options)\s*:[\s\S]*$/i

/** Keeps the failure, drops the instructions written for the model. */
/**
 * A message whose remaining text just introduces something that is no longer
 * there: "…failed due to the following issue:" with nothing after the colon.
 */
function danglesIntoNothing(text: string): boolean {
  return /[:\-–—]\s*$/.test(text.trim())
}

export function stripModelDirectedGuidance(text: string): string {
  const withoutList = text.replace(MODEL_STEERING_LIST_RE, '')
  const withoutSteering = withoutList.replace(MODEL_STEERING_SENTENCE_RE, ' ')
  // Collapse horizontal runs only. Newlines carry the structure that the
  // per-line shell-stack filtering downstream depends on.
  const cleaned = withoutSteering
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/[ ]*\r?\n[ ]*/g, '\n')
    .trim()
  // Never blank out the row - if steering was the whole message, keep the original.
  if (!cleaned) return text.trim()
  // The enumeration WAS the substance. Stripping it produced
  // "InputValidationError: Agent failed due to the following issue:" — a
  // failure that names no failure. Keeping the list beats showing a sentence
  // that points at nothing.
  if (danglesIntoNothing(cleaned)) return text.trim()
  return cleaned
}

export function projectToolError(raw: string): ToolErrorPresentation {
  const normalized = stripModelDirectedGuidance(raw)
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/<sandbox_violations>[\s\S]*?<\/sandbox_violations>/gi, '')
    .replace(/<\/?(?:tool_use_error|error)(?:\s+[^>]*)?>/gi, '')
    .trim()
  const lines = normalized
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  const identifier = lines
    .find(line => /^FullyQualifiedErrorId\s*:/i.test(line))
    ?.replace(/^FullyQualifiedErrorId\s*:\s*/i, '')
  const meaningful = lines.filter(
    line =>
      !/^At line:\d+/i.test(line) &&
      !/^\+\s/.test(line) &&
      !/^~+$/.test(line) &&
      !/^CategoryInfo\s*:/i.test(line) &&
      !/^FullyQualifiedErrorId\s*:/i.test(line),
  )
  const headline = meaningful[0] || identifier || 'Tool execution failed'
  const summary = bounded(headline, 180).text
  const detailParts = [...meaningful.slice(0, 8)]
  if (identifier && !detailParts.some(line => line.includes(identifier))) {
    detailParts.push(`Error: ${identifier}`)
  }
  return {
    summary,
    detail: bounded(detailParts.join('\n'), 1_600).text || summary,
  }
}
