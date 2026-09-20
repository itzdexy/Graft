import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getCwd } from '../../../utils/cwd.js'
import { expandPath } from '../../../utils/path.js'
import { isImplementationRequest } from './buildIntent.js'

const DOCS_SITE_RE =
  /\b(docs?\s*(site|website)|documentation\s*(site|website)|full\s+(website\s+)?docs|graft\s+docs|\/guide)\b/i

const MIN_USEFUL_FILE_BYTES = 32

function isUsefulLocalFile(absolutePath: string): boolean {
  try {
    if (!existsSync(absolutePath)) return false
    const st = statSync(absolutePath)
    return st.isFile() && st.size >= MIN_USEFUL_FILE_BYTES
  } catch {
    return false
  }
}

const STARTER_PAGE_RE =
  /\b(html|landing\s*page|web\s*page|webpage|website|home\s*page|dashboard|saas|showcase|portfolio|agent\s+page)\b/i

export const AGENT_SHOWCASE_RE =
  /\b(agent\s+showcase|agents?\s+showcase|showcase\s+page|agent\s+portfolio|ai\s+agent\s+showcase)\b/i

export function isAgentShowcaseRequest(prompt: string): boolean {
  return AGENT_SHOWCASE_RE.test(prompt)
}

export function isGraftGenericStarterMarkup(html: string): boolean {
  return (
    html.includes('Created by Graft') &&
    (html.includes('starter landing page scaffold') ||
      html.includes('Ship a clean single-page layout') ||
      html.includes('Starter dashboard') ||
      html.includes('Fast</h2><p>Ship a clean single-page layout'))
  )
}

const RUST_SERVER_RE =
  /\b(rust|cargo|axum|actix)\b.{0,48}\b(web\s*server|api\s*server|http\s*server|server)\b/i

function isDashboardRequest(prompt: string): boolean {
  return /\b(dashboard|saas)\b/i.test(prompt)
}

function isDocsSiteRequest(prompt: string): boolean {
  return DOCS_SITE_RE.test(prompt)
}

async function tryWriteDocsSite(
  cwd: string,
): Promise<{ wrote: true; path: string } | { wrote: false }> {
  const indexPath = join(cwd, 'docs', 'index.html')
  if (isUsefulLocalFile(indexPath)) {
    return { wrote: false }
  }
  const { writeGraftDocsSite } = await import('../docs/buildDocsSite.js')
  const result = await writeGraftDocsSite(cwd)
  return { wrote: true, path: result.indexPath }
}

/** Sentence-ending period only — not version dots in model ids (e.g. ornith-1.0-35b). */
const TOPIC_TAIL_RE = /(?:\.\s|$)/

function extractTopicTail(text: string, afterKeyword: string): string | undefined {
  const re = new RegExp(`\\b${afterKeyword}\\s+(.+)`, 'i')
  const match = text.match(re)
  if (!match?.[1]) return undefined
  const raw = match[1].trim()
  const sentenceEnd = raw.search(TOPIC_TAIL_RE)
  const phrase = (sentenceEnd >= 0 ? raw.slice(0, sentenceEnd) : raw).trim()
  return phrase.length > 0 ? phrase : undefined
}

function titleFromPrompt(prompt: string): string {
  const quoted = prompt.match(/["']([^"']+)["']/)
  if (quoted?.[1]) return displayTitle(quoted[1])
  if (isAgentShowcaseRequest(prompt)) return 'Agent Showcase'
  const aboutPhrase = extractTopicTail(prompt, 'about')
  if (aboutPhrase) {
    return displayTitle(cleanTopicPhrase(aboutPhrase))
  }
  const forPhrase = extractTopicTail(prompt, 'for')
  if (forPhrase) {
    const nestedModel = extractModelTopicFromPrompt(forPhrase)
    if (nestedModel) return displayTitle(nestedModel)
    return displayTitle(cleanTopicPhrase(forPhrase))
  }
  const buildMatch = prompt.match(
    /\b(?:code|make|build|create|write)\s+(?:me\s+)?(?:a|an)?\s*(?:html\s+)?(?:about\s+)?(.+?)(?:\s+website|\s+web\s*page|\s+page|$)/i,
  )
  if (buildMatch?.[1]) {
    const phrase = cleanTopicPhrase(buildMatch[1])
    if (phrase.length >= 3) {
      return displayTitle(phrase)
    }
  }
  return 'Welcome'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cleanTopicPhrase(text: string): string {
  return text
    .replace(/\b(a|an|the|html|website|webpage|landing|home)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/** Prefer a concrete model id when the prompt mentions benchmarks or model names. */
function extractModelTopicFromPrompt(prompt: string): string | undefined {
  const benchmark = prompt.match(
    /\bbenchmark\s+of\s+([a-z0-9][\w./-]*(?:[\d.]+b)?)\b/i,
  )
  if (benchmark?.[1]) return benchmark[1].trim()
  const trailingModel = prompt.match(
    /\b(?:model|llm)\s+([a-z0-9][\w./-]*(?:[\d.]+b)?)\s*$/i,
  )
  if (trailingModel?.[1]) return trailingModel[1].trim()
  return undefined
}

/** Pull the subject the user asked the page to be about. */
export function extractTopicFromPrompt(prompt: string): string {
  const modelTopic = extractModelTopicFromPrompt(prompt)
  if (modelTopic) return modelTopic
  const about = extractTopicTail(prompt, 'about')
  if (about) return cleanTopicPhrase(about)
  const forPhrase = extractTopicTail(prompt, 'for')
  if (forPhrase) {
    const nestedModel = extractModelTopicFromPrompt(forPhrase)
    if (nestedModel) return nestedModel
    return cleanTopicPhrase(forPhrase)
  }
  const quoted = prompt.match(/["']([^"']+)["']/)
  if (quoted?.[1]) return cleanTopicPhrase(quoted[1])
  const title = titleFromPrompt(prompt)
  if (title !== 'Welcome') return cleanTopicPhrase(title)
  return 'your project'
}

function formatModelIdDisplay(topic: string): string {
  return topic
    .split('/')
    .map(segment =>
      segment
        .split('-')
        .map(word => {
          if (/^\d+(\.\d+)*$/i.test(word)) return word
          if (/^\d+(\.\d+)*b$/i.test(word)) return word.toUpperCase()
          if (word.length <= 3) return word.toUpperCase()
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .join('-'),
    )
    .join(' / ')
    .slice(0, 80)
}

function displayTitle(topic: string): string {
  if (isModelTopic(topic)) {
    return formatModelIdDisplay(topic)
  }
  return topic
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map(word => {
      if (/^v?\d+(\.\d+)*$/i.test(word)) return word
      if (/^\d+(\.\d+)*b$/i.test(word)) return word.toUpperCase()
      if (word.length <= 3) return word.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
    .slice(0, 80)
}

function isModelTopic(topic: string): boolean {
  return /\/|[\d.]+b\b|llama|ornith|instruct|gpt|mistral|deepseek|gemma|qwen|hugging\s*face/i.test(
    topic,
  )
}

type TopicCard = { title: string; body: string }

function buildTopicFeatureCards(topic: string): TopicCard[] {
  const name = displayTitle(topic)
  if (isModelTopic(topic)) {
    return [
      {
        title: 'Capabilities',
        body: `${name} targets instruction following, coding help, and multi-turn chat with strong tool-use when paired with an agent runtime.`,
      },
      {
        title: 'Hosting',
        body: `Run through Hugging Face Inference, vLLM, or OpenAI-compatible routers — swap endpoints without changing your client code.`,
      },
      {
        title: 'Benchmarks',
        body: `Add latency, throughput, and quality scores for ${name} — MMLU, HumanEval, and your own eval suites.`,
      },
    ]
  }
  const words = topic
    .split(/[\s/_-]+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !/^(and|the|for|with|about)$/i.test(w))
    .slice(0, 3)
  if (words.length >= 2) {
    return words.map((word, index) => ({
      title: displayTitle(word),
      body: [
        `What ${displayTitle(word)} means for ${name} and why it matters to your audience.`,
        `How ${name} delivers on ${displayTitle(word)} — features, workflow, and outcomes.`,
        `Next steps for ${displayTitle(word)}: metrics, integrations, and rollout ideas.`,
      ][index % 3]!,
    }))
  }
  return [
    {
      title: 'Overview',
      body: `${name} in one place — positioning, audience, and the core story behind this page.`,
    },
    {
      title: 'Highlights',
      body: `Key strengths and differentiators for ${name}, ready to replace with your real copy and assets.`,
    },
    {
      title: 'Next steps',
      body: `Add screenshots, pricing, docs links, or additional sections for ${name}.`,
    },
  ]
}

function buildTopicHeroLead(topic: string): string {
  const name = displayTitle(topic)
  if (isModelTopic(topic)) {
    return `${name} — open-weights model overview covering capabilities, hosting options, and benchmark highlights.`
  }
  return `${name} — overview page with editable sections for your copy, imagery, and calls to action.`
}

function buildTopicHighlights(topic: string): string[] {
  const name = displayTitle(topic)
  if (isModelTopic(topic)) {
    return [
      `Model id: ${topic}`,
      'Typical use: chat, coding agents, and structured tool calls',
      'Compatible with OpenAI-style APIs and Hugging Face routers',
      'Extend this page with benchmarks, license, and download links',
    ]
  }
  return [
    `Focused on ${name}`,
    'Responsive layout with editable HTML/CSS',
    'Replace placeholder copy with your brand voice',
    'Extend with API docs, download links, and live demo embeds',
  ]
}

export function buildAgentShowcasePageHtml(prompt: string): string {
  const title = titleFromPrompt(prompt)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070b14;
      --panel: #10182a;
      --border: rgba(255,255,255,0.08);
      --text: #f3f6ff;
      --muted: #9aa7c7;
      --accent: #7c5cff;
      --accent-2: #2dd4bf;
      --glow: rgba(124, 92, 255, 0.35);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background:
        radial-gradient(circle at 15% 0%, rgba(124,92,255,0.18), transparent 40%),
        radial-gradient(circle at 85% 10%, rgba(45,212,191,0.12), transparent 35%),
        var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
    .badge {
      display: inline-block;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: rgba(45, 212, 191, 0.12);
      color: var(--accent-2);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    h1 { font-size: clamp(2.2rem, 5vw, 3.8rem); line-height: 1.05; margin: 0 0 1rem; }
    p.lead { font-size: 1.15rem; color: var(--muted); max-width: 46rem; line-height: 1.6; }
    .cta { margin: 2rem 0 3rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    a.btn {
      text-decoration: none;
      padding: 0.9rem 1.35rem;
      border-radius: 0.85rem;
      font-weight: 600;
    }
    a.primary {
      background: linear-gradient(135deg, var(--accent), #5b8cff);
      color: white;
      box-shadow: 0 12px 40px var(--glow);
    }
    a.secondary { border: 1px solid var(--border); color: var(--text); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
    }
    .card {
      background: rgba(16, 24, 42, 0.92);
      border: 1px solid var(--border);
      border-radius: 1.1rem;
      padding: 1.35rem;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .card:hover { transform: translateY(-2px); border-color: rgba(124,92,255,0.35); }
    .card h2 { margin: 0 0 0.35rem; font-size: 1.15rem; }
    .role { color: var(--accent-2); font-size: 0.85rem; margin-bottom: 0.75rem; }
    .card p { margin: 0; color: var(--muted); font-size: 0.95rem; line-height: 1.55; }
    .tags { margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .tag {
      font-size: 0.75rem;
      padding: 0.25rem 0.55rem;
      border-radius: 999px;
      background: rgba(124,92,255,0.12);
      color: #c4b5fd;
    }
    .section-title { margin: 3rem 0 1rem; font-size: 1.35rem; }
    footer { margin-top: 3rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>${title}</h1>
    <p class="lead">Explore autonomous agents that plan, code, review, and ship — a showcase of multi-agent workflows in your stack.</p>
    <div class="cta">
      <a class="btn primary" href="#agents">Meet the agents</a>
      <a class="btn secondary" href="#contact">Book a demo</a>
    </div>
    <h2 class="section-title" id="agents">Featured agents</h2>
    <section class="grid">
      <article class="card">
        <h2>Planner</h2>
        <div class="role">Strategy · Architecture</div>
        <p>Breaks goals into milestones, drafts graftplan.md, and keeps scope honest before code lands.</p>
        <div class="tags"><span class="tag">Planning</span><span class="tag">Roadmaps</span></div>
      </article>
      <article class="card">
        <h2>Coder</h2>
        <div class="role">Implementation · Refactors</div>
        <p>Writes production files with Write/Edit tools, runs tests, and iterates until the build is green.</p>
        <div class="tags"><span class="tag">TypeScript</span><span class="tag">Full-stack</span></div>
      </article>
      <article class="card">
        <h2>Reviewer</h2>
        <div class="role">Quality · Security</div>
        <p>Audits diffs for regressions, missing tests, and risky patterns before you merge.</p>
        <div class="tags"><span class="tag">PR review</span><span class="tag">Hardening</span></div>
      </article>
      <article class="card">
        <h2>Researcher</h2>
        <div class="role">Discovery · Docs</div>
        <p>Pulls API docs, compares libraries, and returns concise recommendations with links.</p>
        <div class="tags"><span class="tag">Web</span><span class="tag">MCP</span></div>
      </article>
      <article class="card">
        <h2>DevOps</h2>
        <div class="role">CI/CD · Deploy</div>
        <p>Wires pipelines, env vars, and release checks so shipping stays boring in a good way.</p>
        <div class="tags"><span class="tag">GitHub Actions</span><span class="tag">Docker</span></div>
      </article>
      <article class="card">
        <h2>Browser</h2>
        <div class="role">UI · E2E</div>
        <p>Exercises live apps, captures screenshots, and validates flows end-to-end.</p>
        <div class="tags"><span class="tag">Playwright</span><span class="tag">QA</span></div>
      </article>
    </section>
  </main>
</body>
</html>
`
}

export function buildStarterLandingPageHtml(prompt: string): string {
  const topic = extractTopicFromPrompt(prompt)
  const title = displayTitle(topic)
  const lead = buildTopicHeroLead(topic)
  const cards = buildTopicFeatureCards(topic)
  const highlights = buildTopicHighlights(topic)
  const cardsHtml = cards
    .map(
      card =>
        `<article class="card"><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.body)}</p></article>`,
    )
    .join('\n      ')
  const highlightsHtml = highlights
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('\n          ')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(lead)}" />
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0b1020;
      --card: #141b2d;
      --text: #f4f7ff;
      --muted: #9aa7c7;
      --accent: #7c5cff;
      --accent-2: #2dd4bf;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: radial-gradient(circle at top, #1a2140, var(--bg));
      color: var(--text);
      min-height: 100vh;
    }
    .wrap { max-width: 960px; margin: 0 auto; padding: 3rem 1.5rem; }
    .badge {
      display: inline-block;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: rgba(124, 92, 255, 0.15);
      color: var(--accent-2);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    h1 { font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1.1; margin: 0 0 1rem; }
    p.lead { font-size: 1.15rem; color: var(--muted); max-width: 42rem; line-height: 1.6; }
    .cta { margin-top: 2rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    a.btn {
      text-decoration: none;
      padding: 0.85rem 1.25rem;
      border-radius: 0.75rem;
      font-weight: 600;
    }
    a.primary { background: linear-gradient(135deg, var(--accent), #5b8cff); color: white; }
    a.secondary { border: 1px solid rgba(255,255,255,0.15); color: var(--text); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-top: 3rem;
    }
    .card {
      background: rgba(20, 27, 45, 0.9);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 1rem;
      padding: 1.25rem;
    }
    .card h2 { margin: 0 0 0.5rem; font-size: 1.05rem; }
    .card p { margin: 0; color: var(--muted); font-size: 0.95rem; line-height: 1.55; }
    .highlights {
      margin-top: 2.5rem;
      background: rgba(20, 27, 45, 0.65);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 1rem;
      padding: 1.25rem 1.5rem;
    }
    .highlights h2 { margin: 0 0 0.75rem; font-size: 1rem; }
    .highlights ul { margin: 0; padding-left: 1.2rem; color: var(--muted); line-height: 1.6; }
    footer { margin-top: 3rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <p class="lead">${escapeHtml(lead)}</p>
    <div class="cta">
      <a class="btn primary" href="#features">Explore</a>
      <a class="btn secondary" href="#highlights">Details</a>
    </div>
    <section class="grid" id="features">
      ${cardsHtml}
    </section>
    <section class="highlights" id="highlights">
      <h2>Highlights</h2>
      <ul>
          ${highlightsHtml}
      </ul>
    </section>
  </main>
</body>
</html>
`
}

export function buildStarterDashboardHtml(prompt: string): string {
  const title = titleFromPrompt(prompt)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Dashboard</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0c1222;
      --panel: #121a2e;
      --border: rgba(255,255,255,0.08);
      --text: #eef2ff;
      --muted: #94a3b8;
      --accent: #6366f1;
      --accent-2: #22d3ee;
      --success: #34d399;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: grid;
      grid-template-columns: 240px 1fr;
    }
    aside {
      border-right: 1px solid var(--border);
      padding: 1.5rem 1rem;
      background: #0a0f1c;
    }
    .logo { font-weight: 700; font-size: 1.1rem; margin-bottom: 2rem; }
    nav a {
      display: block;
      color: var(--muted);
      text-decoration: none;
      padding: 0.55rem 0.75rem;
      border-radius: 0.5rem;
      margin-bottom: 0.25rem;
    }
    nav a.active, nav a:hover { background: rgba(99,102,241,0.15); color: var(--text); }
    main { padding: 1.5rem 2rem; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    h1 { margin: 0; font-size: 1.75rem; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .metric {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.1rem 1.25rem;
    }
    .metric span { color: var(--muted); font-size: 0.85rem; }
    .metric strong { display: block; font-size: 1.6rem; margin-top: 0.35rem; }
    .metric.up strong { color: var(--success); }
    .grid-2 {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 900px) { body { grid-template-columns: 1fr; } .grid-2 { grid-template-columns: 1fr; } }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.25rem;
    }
    .panel h2 { margin: 0 0 1rem; font-size: 1rem; }
    .chart {
      height: 220px;
      border-radius: 0.75rem;
      background: linear-gradient(180deg, rgba(99,102,241,0.25), transparent);
      border: 1px dashed var(--border);
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 0.9rem;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.6rem 0; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 500; }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      background: rgba(34,211,238,0.15);
      color: var(--accent-2);
      font-size: 0.75rem;
    }
  </style>
</head>
<body>
  <aside>
    <div class="logo">${title}</div>
    <nav>
      <a class="active" href="#">Overview</a>
      <a href="#">Customers</a>
      <a href="#">Billing</a>
      <a href="#">Settings</a>
    </nav>
  </aside>
  <main>
    <header>
      <div>
        <span class="badge">Starter dashboard</span>
        <h1>Overview</h1>
      </div>
    </header>
    <section class="metrics">
      <article class="metric up"><span>Monthly revenue</span><strong>$12.4k</strong></article>
      <article class="metric"><span>Active users</span><strong>1,284</strong></article>
      <article class="metric up"><span>Conversion</span><strong>4.2%</strong></article>
      <article class="metric"><span>Churn</span><strong>1.1%</strong></article>
    </section>
    <section class="grid-2">
      <article class="panel">
        <h2>Revenue trend</h2>
        <div class="chart">Chart placeholder — connect your analytics API</div>
      </article>
      <article class="panel">
        <h2>Recent signups</h2>
        <table>
          <thead><tr><th>User</th><th>Plan</th></tr></thead>
          <tbody>
            <tr><td>alex@example.com</td><td>Pro</td></tr>
            <tr><td>sam@example.com</td><td>Starter</td></tr>
            <tr><td>jordan@example.com</td><td>Team</td></tr>
          </tbody>
        </table>
      </article>
    </section>
  </main>
</body>
</html>
`
}

function slugFromPrompt(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^(the|and|for|with|rust|web|server|build|make|code|a|an)$/.test(w))
  const base = words.slice(0, 2).join('_') || 'graft_app'
  return base.replace(/^_+|_+$/g, '') || 'graft_app'
}

export function buildRustCargoToml(projectName: string): string {
  return `[package]
name = "${projectName}"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
`
}

export function buildRustMainRs(projectName: string): string {
  const title = projectName.replace(/_/g, ' ')
  return `use axum::{routing::get, Json, Router};
use serde::Serialize;

#[derive(Serialize)]
struct Hello {
    message: String,
}

async fn root() -> Json<Hello> {
    Json(Hello {
        message: format!("Hello from ${title} — starter Rust web server"),
    })
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(root));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("bind 127.0.0.1:8080");
    println!("listening on http://127.0.0.1:8080");
    axum::serve(listener, app).await.expect("serve");
}
`
}

async function tryWriteRustWebServerStarter(
  userPrompt: string,
  cwd: string,
): Promise<{ wrote: true; path: string } | { wrote: false }> {
  const mainFlat = join(cwd, 'main.rs')
  const mainSrc = join(cwd, 'src', 'main.rs')
  const cargo = join(cwd, 'Cargo.toml')

  if (isUsefulLocalFile(mainSrc) && existsSync(cargo)) {
    return { wrote: true, path: mainSrc }
  }

  const projectName = slugFromPrompt(userPrompt)
  await mkdir(join(cwd, 'src'), { recursive: true })

  if (!existsSync(cargo)) {
    await writeFile(cargo, buildRustCargoToml(projectName), 'utf8')
  }

  if (isUsefulLocalFile(mainFlat) && !isUsefulLocalFile(mainSrc)) {
    const content = await readFile(mainFlat, 'utf8')
    await writeFile(mainSrc, content, 'utf8')
  } else if (!isUsefulLocalFile(mainSrc)) {
    await writeFile(mainSrc, buildRustMainRs(projectName), 'utf8')
  }

  const gitignore = join(cwd, '.gitignore')
  if (!existsSync(gitignore)) {
    await writeFile(
      gitignore,
      '/target\nCargo.lock\n**/*.rs.bk\n',
      'utf8',
    )
  }
  return { wrote: true, path: mainSrc }
}

function isRustWebServerRequest(prompt: string): boolean {
  return (
    /\bbuild\s+a\s+rust\b/i.test(prompt) ||
    RUST_SERVER_RE.test(prompt) ||
    (/\brust\b/i.test(prompt) && /\bweb\s*server\b/i.test(prompt))
  )
}

/** Last-resort write when the model fails to call Write after nudges. */
export async function tryImplementationFilesystemFallback(
  userPrompt: string,
  cwd: string = getCwd(),
): Promise<{ wrote: true; path: string } | { wrote: false }> {
  if (!isImplementationRequest(userPrompt)) {
    return { wrote: false }
  }
  if (isRustWebServerRequest(userPrompt)) {
    return tryWriteRustWebServerStarter(userPrompt, cwd)
  }
  if (isDocsSiteRequest(userPrompt)) {
    return tryWriteDocsSite(cwd)
  }
  // HTML landing pages are not auto-scaffolded — the model must call Write with
  // real content. Starter templates were misleading (branded placeholders).
  if (STARTER_PAGE_RE.test(userPrompt)) {
    return { wrote: false }
  }
  return { wrote: false }
}
