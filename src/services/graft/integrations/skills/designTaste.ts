/** Condensed from taste-skill (MIT) — https://github.com/Leonxlnx/taste-skill */

export const DESIGN_TASTE_SKILL = `# Design taste (anti-slop frontend)

You are implementing UI that must **not** look like generic AI output. Follow taste-skill v2 principles.

## Dials (infer from brief; default mid)

- **DESIGN_VARIANCE** (1-10): layout experimentation. Low = centered, predictable. High = asymmetric grids, offset type, broken columns.
- **MOTION_INTENSITY** (1-10): Low = hover only. High = scroll reveals, staggered entrances, magnetic buttons (GSAP or CSS).
- **VISUAL_DENSITY** (1-10): Low = editorial whitespace. High = dashboard density.

## Hard rules

- **No em dashes** in user-facing copy you write for the UI.
- No purple-gradient-on-white clichés, no Inter-everything, no identical card grids without hierarchy.
- Typography: pair a distinctive display face with a readable body face; use scale (clamp), not fixed px everywhere.
- Color: one accent, neutrals with warmth or coolness — not flat gray-on-white.
- Spacing: use a consistent rhythm (4/8 or 4px grid); align to a real grid, not arbitrary margins.
- Motion: prefer transform/opacity; respect \`prefers-reduced-motion\`.

## Process

1. Infer product tone from the brief (SaaS, editorial, brutalist, luxury, playful).
2. State your dial settings in one line before coding.
3. Build a **design-system map**: colors, type scale, radius, shadow, spacing tokens.
4. Implement one hero/signature section first — if that feels generic, redesign before spreading patterns.
5. Run a **redesign audit**: list 3 things that still look "template" and fix them.

## Libraries

- Prefer project stack (Tailwind, CSS modules, etc.). GSAP only when MOTION_INTENSITY >= 7 and not already heavy.
- Images: purposeful photography or abstract shapes — not stock-photo placeholders.

## Deliverable

Production-ready components matching the repo's framework. No lorem ipsum in final UI unless user asked for placeholders.
`

export const TASTE_MINIMALIST_SKILL = `# Minimalist UI (taste-skill variant)

Editorial product UI (Notion/Linear energy): restrained palette, crisp hierarchy, generous whitespace, subtle borders not heavy shadows, system or premium sans, one accent for primary actions only. No decorative gradients. Motion: 150-200ms ease, no bounce unless playful brand.
`

export const TASTE_BRUTALIST_SKILL = `# Industrial brutalist UI (taste-skill variant)

Swiss/grid discipline, sharp contrast, monospace or grotesk type, visible structure (rules, labels), experimental layout OK, no rounded-everything softness. Accessibility still required: contrast ratios, focus rings, readable type sizes.
`

export const TASTE_SOFT_SKILL = `# Soft premium UI (taste-skill variant)

Calm, expensive feel: soft contrast, large radius, spring motion (stiffness 120-180), premium serif or humanist sans, layered subtle shadows, muted pastels or warm neutrals. Avoid harsh pure black — use ink tones.
`

export const TASTE_REDESIGN_SKILL = `# Redesign existing UI (taste-skill)

1. Screenshot or read current UI structure — list hierarchy problems (weak H1, flat CTAs, cramped sections).
2. Propose token changes only — do not rewrite business logic.
3. Fix spacing and type scale first, then color, then motion.
4. Keep diffs minimal per file; match existing component patterns.
`

export const TASTE_IMAGE_TO_CODE_SKILL = `# Image to code (taste-skill pipeline)

1. If user provides a mockup/screenshot: describe layout regions, type hierarchy, and color tokens before coding.
2. Match spacing and alignment to the reference — do not "improve" layout without asking.
3. Implement responsive behavior where the reference is ambiguous.
4. Compare result mentally to reference; list top 3 visual gaps and fix.
`
