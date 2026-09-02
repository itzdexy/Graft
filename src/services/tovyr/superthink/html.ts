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

/**
 * Tokens first, then components.
 *
 * The palette used to be hard-coded dark while `color-scheme` advertised
 * `light dark`, so a light-mode browser painted native form controls light
 * against a #0b0c10 page — unreadable text in every input. Both schemes are
 * now defined explicitly and `color-scheme` follows whichever one is active.
 */
const STYLE = `
  :root {
    color-scheme: dark;
    --bg: #0b0c10;
    --surface: #15171c;
    --surface-sunken: #0e1014;
    --border: #262a33;
    --text: #e6e6e6;
    --text-muted: #9aa3b2;
    --accent: #6b9dff;
    --accent-bg: #3b82f6;
    --accent-fg: #ffffff;
    --danger: #e0556b;
    --research-bg: #101522;
    --research-border: #2d4a7a;
    --ring: #8ab4ff;
    --radius: 12px;
    --radius-sm: 8px;
  }
  @media (prefers-color-scheme: light) {
    :root {
      color-scheme: light;
      --bg: #ffffff;
      --surface: #f7f8fa;
      --surface-sunken: #ffffff;
      --border: #d8dce3;
      --text: #14161a;
      --text-muted: #5b6472;
      --accent: #1a4fd6;
      --accent-bg: #2563eb;
      --accent-fg: #ffffff;
      --danger: #c0304a;
      --research-bg: #eef3fc;
      --research-border: #b3c9ee;
      --ring: #2563eb;
    }
  }
  * { box-sizing: border-box; }
  body {
    font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    margin: 0; padding: 2rem 1.25rem 4rem; max-width: 760px; margin-inline: auto;
    background: var(--bg); color: var(--text);
    -webkit-font-smoothing: antialiased;
  }
  h1 { font-size: 1.5rem; line-height: 1.25; margin: 0 0 .35rem; letter-spacing: -.01em; }
  .goal { color: var(--accent); margin: 0 0 1.5rem; }
  .q, .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1rem 1.25rem; margin: 0 0 1rem;
  }
  .q label.prompt { display: block; font-weight: 600; margin-bottom: .5rem; }
  .q .help { color: var(--text-muted); font-size: .85rem; margin: -.25rem 0 .5rem; }
  input[type=text], textarea, select {
    width: 100%; padding: .6rem .7rem; border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-sunken); color: var(--text); font: inherit;
  }
  textarea { min-height: 64px; resize: vertical; }
  .opts label {
    display: flex; align-items: center; gap: .5rem;
    padding: .25rem 0; font-weight: 400; cursor: pointer;
  }
  .opts input { accent-color: var(--accent-bg); flex: none; }
  /* Keyboard users need to see where they are — this form is entirely inputs. */
  :is(input, textarea, select, button, a):focus-visible {
    outline: 2px solid var(--ring); outline-offset: 2px;
  }
  .err { border-color: var(--danger); }
  .err-msg { color: var(--danger); font-size: .85rem; margin-top: .35rem; }
  .actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1.25rem; }
  button {
    font: inherit; font-weight: 600; padding: .6rem 1.1rem;
    border-radius: var(--radius-sm); border: 1px solid transparent; cursor: pointer;
    background: var(--accent-bg); color: var(--accent-fg);
    transition: filter .12s ease, transform .12s ease;
  }
  button:hover { filter: brightness(1.1); }
  button:active { transform: translateY(1px); }
  button.secondary {
    background: transparent; color: var(--text); border-color: var(--border);
  }
  button.secondary:hover { background: var(--surface); filter: none; }
  @media (prefers-reduced-motion: reduce) {
    button { transition: none; }
    button:active { transform: none; }
  }
  ul, ol { padding-left: 1.25rem; }
  li { margin: .2rem 0; }
  .research {
    border-color: var(--research-border); background: var(--research-bg);
    font-size: .92rem; white-space: pre-wrap;
  }
  .card strong { display: block; margin-bottom: .4rem; }
  code, pre { background: var(--surface-sunken); border-radius: 6px; }
  pre { padding: 1rem; overflow: auto; }
  a { color: var(--accent); }
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
    <h1>Brainstorm — clarify before we build</h1>
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
    <h1>Implementation plan — approve to start coding</h1>
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
    <div class="actions">
      <form method="POST" action="/approve">
        <button type="submit">Approve &amp; build →</button>
      </form>
      <form method="POST" action="/revise">
        <button type="submit" class="secondary">↩ Revise answers</button>
      </form>
    </div>`
  return page('Superthinker — plan preview', body)
}

export function renderThanksPage(): string {
  return page(
    'Superthinker — done',
    `<h1>Sent to the CLI</h1>
     <p>Your answers and approval are on their way back to Tovyr. You can close this tab and return to your terminal.</p>`,
  )
}

/** Wrap arbitrary built-artifact HTML in a labeled result-preview chrome. */
export function renderResultPreviewIndex(
  title: string,
  links: { label: string; href: string }[],
): string {
  const body = `
    <h1>Result preview — ${escapeHtml(title)}</h1>
    <div class="card"><ul>${links
      .map(l => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`)
      .join('')}</ul></div>`
  return page('Superthinker — result preview', body)
}
