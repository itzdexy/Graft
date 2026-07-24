/** Source-quality heuristics adapted from Odysseus `research_utils.is_low_quality`. */

export const LOW_QUALITY_MARKERS = [
  'insufficient to',
  'content is insufficient',
  'no substantive data',
  'does not contain',
  'not relevant to',
  'no relevant information',
  'unable to extract',
  'completely unrelated',
  'boilerplate',
  'footer text',
  'cookie consent',
  'cookie banner',
  'cookie notice',
  'copyright notice',
  'copyright footer',
  'all rights reserved',
] as const

export function isLowQualitySource(summary: string | undefined | null): boolean {
  if (!summary || typeof summary !== 'string') return true
  const low = summary.toLowerCase()
  return LOW_QUALITY_MARKERS.some(marker => low.includes(marker))
}

export function filterQualitySources<T extends { summary?: string; evidence?: string }>(
  findings: T[],
): T[] {
  return findings.filter(f => {
    const text = f.summary ?? f.evidence ?? ''
    return !isLowQualitySource(text)
  })
}
