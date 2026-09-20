/** Agency agent divisions — https://github.com/msitarzewski/agency-agents */

export type AgencyDivision = {
  id: string
  label: string
  agents: Array<{ slug: string; label: string }>
}

const RAW_BASE =
  'https://raw.githubusercontent.com/msitarzewski/agency-agents/main'

export const AGENCY_RAW_BASE = RAW_BASE

/** Curated high-signal agents (full roster available via \`agency sync all\`). */
export const AGENCY_DIVISIONS: AgencyDivision[] = [
  {
    id: 'engineering',
    label: 'Engineering',
    agents: [
      { slug: 'engineering-frontend-developer', label: 'Frontend Developer' },
      { slug: 'engineering-backend-architect', label: 'Backend Architect' },
      { slug: 'engineering-ai-engineer', label: 'AI Engineer' },
      { slug: 'engineering-devops-automator', label: 'DevOps Automator' },
      { slug: 'engineering-code-reviewer', label: 'Code Reviewer' },
      { slug: 'engineering-software-architect', label: 'Software Architect' },
      { slug: 'engineering-prompt-engineer', label: 'Prompt Engineer' },
      { slug: 'engineering-multi-agent-systems-architect', label: 'Multi-Agent Architect' },
    ],
  },
  {
    id: 'design',
    label: 'Design',
    agents: [
      { slug: 'design-ui-designer', label: 'UI Designer' },
      { slug: 'design-ux-researcher', label: 'UX Researcher' },
      { slug: 'design-brand-guardian', label: 'Brand Guardian' },
      { slug: 'design-whimsy-injector', label: 'Whimsy Injector' },
    ],
  },
  {
    id: 'product',
    label: 'Product',
    agents: [
      { slug: 'product-manager', label: 'Product Manager' },
      { slug: 'product-sprint-prioritizer', label: 'Sprint Prioritizer' },
      { slug: 'product-feedback-synthesizer', label: 'Feedback Synthesizer' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    agents: [
      { slug: 'marketing-content-creator', label: 'Content Creator' },
      { slug: 'marketing-growth-hacker', label: 'Growth Hacker' },
      { slug: 'marketing-seo-specialist', label: 'SEO Specialist' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    agents: [
      { slug: 'security-appsec-engineer', label: 'AppSec Engineer' },
      { slug: 'security-penetration-tester', label: 'Penetration Tester' },
      { slug: 'security-incident-responder', label: 'Incident Responder' },
    ],
  },
]

export function agencyRawUrl(divisionId: string, slug: string): string {
  return `${RAW_BASE}/${divisionId}/${slug}.md`
}

export function inferAgencyDivision(slug: string): string | null {
  const known = AGENCY_DIVISIONS.map(d => d.id)
  for (const id of known) {
    if (slug === id || slug.startsWith(`${id}-`)) return id
  }
  return null
}

export function findAgencyAgent(slug: string): { division: string; label: string } | null {
  for (const div of AGENCY_DIVISIONS) {
    const hit = div.agents.find(a => a.slug === slug)
    if (hit) return { division: div.id, label: hit.label }
  }
  const division = inferAgencyDivision(slug)
  if (division) {
    return { division, label: slug }
  }
  return null
}

export function listAgencySlugs(): string[] {
  return AGENCY_DIVISIONS.flatMap(d => d.agents.map(a => a.slug))
}
