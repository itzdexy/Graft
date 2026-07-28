import type { SuperthinkPlan, SuperthinkQuestion } from './types.js'

/** Escape text for safe interpolation into HTML (prevents injection on the local page). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    margin: 0; padding: 2rem; max-width: 760px; margin-inline: auto;
    background: #0b0c10; color: #e6e6e6;
  }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .goal { color: #8ab4ff; margin: 0 0 1.5rem; }
  .q { background: #15171c; border: 1px solid #262a33; border-radius: 12px; padding: 1rem 1.25rem; margin: 0 0 1rem; }
  .q label.prompt { display: block; font-weight: 600; margin-bottom: .5rem; }
  .q .help { color: #9aa3b2; font-size: .85rem; margin: -.25rem 0 .5rem; }
  input[type=text], textarea, select {
    width: 100%; padding: .6rem .7rem; border-radius: 8px; border: 1px solid #333;
    background: #0e1014; color: #e6e6e6; font: inherit;
  }
  textarea { min-height: 64px; resize: vertical; }
  .opts label { display: block; padding: .15rem 0; font-weight: 400; }
  .err { border-color: #e0556b; }
  .err-msg { color: #e0556b; font-size: .85rem; margin-top: .35rem; }
  .actions { display: flex; gap: .75rem; margin-top: 1.25rem; }
  button {
    font: inherit; font-weight: 600; padding: .6rem 1.1rem; border-radius: 8px;
    border: 0; cursor: pointer; background: #3b82f6; color: #fff;
  }
  button.secondary { background: #2a2f3a; color: #e6e6e6; }
  ul { padding-left: 1.2rem; }
  .card { background: #15171c; border: 1px solid #262a33; border-radius: 12px; padding: 1rem 1.25rem; margin: 0 0 1rem; }
  .research { border-color: #2d4a7a; background: #101522; font-size: .92rem; white-space: pre-wrap; }
  code, pre { background: #0e1014; border-radius: 6px; }
  pre { padding: 1rem; overflow:auto; }
`

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body>${body}</body></html>`
}

function fieldFor(q: SuperthinkQuestion, invalid: boolean): string {
  const cls = invalid ? 'err' : ''
  const name = escapeHtml(q.id)
  switch (q.type) {
    case 'boolean':
      return `<label class="opts"><input type="checkbox" name="${name}" value="true"> Yes</label>`
    case 'choice':
      return `<select name="${name}" class="${cls}">${(q.options ?? [])
        .map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`)
        .join('')}</select>`
    case 'multichoice':
      return `<div class="opts">${(q.options ?? [])
        .map(
          o =>
            `<label><input type="checkbox" name="${name}" value="${escapeHtml(o)}"> ${escapeHtml(o)}</label>`,
        )
        .join('')}</div>`
    default: {
      const ph = q.placeholder ? ` placeholder="${escapeHtml(q.placeholder)}"` : ''
      return `<textarea name="${name}" class="${cls}"${ph}></textarea>`
    }
  }
}

/** The questionnaire form. `missing` ids are highlighted as required-but-blank. */
export function renderQuestionsPage(
  goal: string,
  questions: SuperthinkQuestion[],
  missing: string[] = [],
  researchBrief?: string | null,
): string {
  const missingSet = new Set(missing)
  const researchBlock = researchBrief?.trim()
    ? `<div class="card research"><strong>Research so far</strong><p>${escapeHtml(researchBrief.trim())}</p></div>`
    : ''
  const body = `
    <h1>🧠 Brainstorm — clarify before we build</h1>
    <p class="goal">${escapeHtml(goal)}</p>
    ${researchBlock}
    <form method="POST" action="/submit">
      ${questions
        .map(q => {
          const invalid = missingSet.has(q.id)
          return `<div class="q">
            <label class="prompt">${escapeHtml(q.prompt)}${q.required ? ' *' : ''}</label>
            ${q.help ? `<div class="help">${escapeHtml(q.help)}</div>` : ''}
            ${fieldFor(q, invalid)}
            ${invalid ? '<div class="err-msg">This one is required.</div>' : ''}
          </div>`
        })
        .join('')}
      <div class="actions"><button type="submit">Send answers to the CLI →</button></div>
    </form>`
  return page('Superthinker — questions', body)
}

/** The plan/design preview shown for sign-off before any building happens. */
export function renderPlanPage(
  goal: string,
  plan: SuperthinkPlan,
  researchBrief?: string | null,
): string {
  const researchBlock = researchBrief?.trim()
    ? `<div class="card research"><strong>Research context</strong><p>${escapeHtml(researchBrief.trim())}</p></div>`
    : ''
  const body = `
    <h1>📐 Implementation plan — approve to start coding</h1>
    <p class="goal">${escapeHtml(goal)}</p>
    ${researchBlock}
    <div class="card"><strong>Understanding</strong><p>${escapeHtml(plan.summary)}</p></div>
    ${
      plan.decisions.length
        ? `<div class="card"><strong>Decisions from your answers</strong><ul>${plan.decisions
            .map(d => `<li>${escapeHtml(d)}</li>`)
            .join('')}</ul></div>`
        : ''
    }
    <div class="card"><strong>Plan</strong><ol>${plan.steps
      .map(s => `<li>${escapeHtml(s)}</li>`)
      .join('')}</ol></div>
    <form method="POST" action="/approve" style="display:inline">
      <button type="submit">Approve &amp; build →</button>
    </form>
    <form method="POST" action="/revise" style="display:inline">
      <button type="submit" class="secondary">↩ Revise answers</button>
    </form>`
  return page('Superthinker — plan preview', body)
}

export function renderThanksPage(): string {
  return page(
    'Superthinker — done',
    `<h1>✅ Sent to the CLI</h1>
     <p>Your answers and approval are on their way back to Tovyr. You can close this tab and return to your terminal.</p>`,
  )
}

/** Wrap arbitrary built-artifact HTML in a labeled result-preview chrome. */
export function renderResultPreviewIndex(
  title: string,
  links: { label: string; href: string }[],
): string {
  const body = `
    <h1>👀 Result preview — ${escapeHtml(title)}</h1>
    <div class="card"><ul>${links
      .map(l => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`)
      .join('')}</ul></div>`
  return page('Superthinker — result preview', body)
}
