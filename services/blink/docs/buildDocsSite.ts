import { BLINK_VERSION } from '../../../constants/blink.js'

export type DocsSiteResult = {
  indexPath: string
  pages: string[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

/** Full static docs website (sidebar + sections) for Blink. */
export function buildBlinkDocsSiteHtml(): string {
  const version = esc(BLINK_VERSION)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blink Documentation</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0a0e1a;
      --panel: #111827;
      --border: rgba(255,255,255,0.08);
      --text: #eef2ff;
      --muted: #94a3b8;
      --accent: #7c5cff;
      --accent-2: #2dd4bf;
      --code: #1e293b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .layout {
      display: grid;
      grid-template-columns: 260px 1fr;
      min-height: 100vh;
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      nav { position: sticky; top: 0; z-index: 10; border-bottom: 1px solid var(--border); }
    }
    nav {
      background: #0d1220;
      border-right: 1px solid var(--border);
      padding: 1.5rem 1rem;
    }
    nav .brand {
      font-weight: 700;
      font-size: 1.1rem;
      margin-bottom: 0.25rem;
      color: var(--accent-2);
    }
    nav .ver { font-size: 0.8rem; color: var(--muted); margin-bottom: 1.25rem; }
    nav input[type="search"] {
      width: 100%;
      margin-bottom: 1rem;
      padding: 0.5rem 0.65rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
      font-size: 0.88rem;
    }
    nav input[type="search"]::placeholder { color: var(--muted); }
    nav a.hidden { display: none; }
    nav a {
      display: block;
      color: var(--muted);
      text-decoration: none;
      padding: 0.4rem 0.65rem;
      border-radius: 0.5rem;
      font-size: 0.92rem;
      margin-bottom: 0.15rem;
    }
    nav a:hover, nav a.active { background: rgba(124,92,255,0.15); color: var(--text); }
    main { padding: 2rem 2.5rem 4rem; max-width: 920px; }
    h1 { font-size: 2rem; margin: 0 0 0.5rem; }
    h2 {
      font-size: 1.35rem;
      margin: 2.5rem 0 0.75rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    h2:first-of-type { border-top: none; padding-top: 0; margin-top: 1rem; }
    p.lead { color: var(--muted); font-size: 1.05rem; max-width: 42rem; }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.88rem;
    }
    code {
      background: var(--code);
      padding: 0.15rem 0.4rem;
      border-radius: 0.35rem;
    }
    pre {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1rem 1.1rem;
      overflow-x: auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin: 1.25rem 0;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 0.85rem;
      padding: 1rem 1.1rem;
    }
    .card h3 { margin: 0 0 0.5rem; font-size: 1rem; }
    .card p { margin: 0; color: var(--muted); font-size: 0.92rem; }
    ul { padding-left: 1.2rem; color: var(--muted); }
    li { margin: 0.35rem 0; }
    .badge {
      display: inline-block;
      background: rgba(45,212,191,0.15);
      color: var(--accent-2);
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      font-size: 0.8rem;
      margin-bottom: 1rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0 1.5rem;
      font-size: 0.92rem;
    }
    th, td {
      text-align: left;
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    th { color: var(--muted); font-weight: 600; }
    footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.88rem;
    }
  </style>
</head>
<body>
  <div class="layout">
    <nav>
      <div class="brand">Blink</div>
      <div class="ver">v${version}</div>
      <input type="search" id="doc-search" placeholder="Search docs…" aria-label="Search documentation" />
      <a href="#start" data-keywords="getting started install quick">Getting started</a>
      <a href="#commands" data-keywords="slash commands reference">Command reference</a>
      <a href="#workflow" data-keywords="plan code build">Workflow</a>
      <a href="#agent" data-keywords="agent repo verify">Agent &amp; repo</a>
      <a href="#integrations" data-keywords="ecosystem browser recipe">Integrations</a>
      <a href="#session" data-keywords="retry undo compact">Session control</a>
      <a href="#modes" data-keywords="ask build bypass plan">Modes</a>
      <a href="#live" data-keywords="thought write activity ui">Live activity UI</a>
      <a href="#troubleshooting" data-keywords="doctor provider fix">Troubleshooting</a>
    </nav>
    <main>
      <span class="badge">Documentation</span>
      <h1 id="start">Blink docs</h1>
      <p class="lead">Local-first AI coding agent with OpenCode-style UI, multi-provider support, and automatic file recovery when models fail to write.</p>

      <div class="grid">
        <article class="card"><h3>Quick start</h3><p>Run <code>blink</code>, then <code>/blink</code> to connect a provider.</p></article>
        <article class="card"><h3>Build</h3><p><code>/code</code> or <code>blink build …</code> — auto-switches to code mode.</p></article>
        <article class="card"><h3>This site</h3><p>Run <code>/guide</code> or <code>/docs</code> to regenerate <code>docs/index.html</code>.</p></article>
      </div>

      <h2 id="commands">Command reference</h2>
      <table>
        <thead><tr><th>Command</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>/guide</code> · <code>/docs</code></td><td>Write this documentation site to <code>docs/index.html</code></td></tr>
          <tr><td><code>/code</code></td><td>Code mode — auto-accept file edits</td></tr>
          <tr><td><code>/plan</code></td><td>Plan mode — draft <code>blinkplan.md</code></td></tr>
          <tr><td><code>/build &lt;feature&gt;</code></td><td>Ship a feature end-to-end</td></tr>
          <tr><td><code>/doctor</code></td><td>Install and PATH health check</td></tr>
          <tr><td><code>/provider list</code></td><td>Switch AI provider or model</td></tr>
          <tr><td><code>/agent start &lt;goal&gt;</code></td><td>Autonomous agent loop</td></tr>
          <tr><td><code>/verify</code></td><td>Run tests, lint, or build</td></tr>
        </tbody>
      </table>

      <h2 id="workflow">Workflow</h2>
      <ul>
        <li><code>/plan</code> — draft <code>blinkplan.md</code></li>
        <li><code>/code</code> — implement from the plan</li>
        <li><code>/build &lt;feature&gt;</code> — ship a feature</li>
        <li><code>/analyze</code> — repo health scan</li>
        <li><code>/review [path]</code> — code review</li>
        <li><code>/debug &lt;issue&gt;</code> — ranked hypotheses</li>
      </ul>

      <h2 id="agent">Agent &amp; repo intelligence</h2>
      <pre>/agent start &lt;goal&gt;
/agent --autofix
/verify [test|lint|build]
/repo analyze · /repo search &lt;q&gt;
/deep-research &lt;question&gt;
/superthink &lt;goal&gt;</pre>

      <h2 id="integrations">Integrations</h2>
      <ul>
        <li><code>/ecosystem</code> — upstream agent adapters (Codex, Aider, Goose, …)</li>
        <li><code>/integrations</code> — taste-skill, vibecode, Agency personas</li>
        <li><code>/recipe start ship-feature</code> — workflow recipes</li>
        <li><code>/browser research &lt;topic&gt;</code> — web research</li>
      </ul>

      <h2 id="session">Session control</h2>
      <ul>
        <li><code>/retry</code> · <code>/undo</code> · <code>/rewind</code></li>
        <li><code>/compact</code> — summarize context</li>
        <li><code>/personality [id]</code> — concise, thorough, pair, …</li>
      </ul>

      <h2 id="modes">Modes</h2>
      <ul>
        <li><strong>Ask</strong> — read-only planning</li>
        <li><strong>Build</strong> (<code>/code</code>) — auto-accept file edits</li>
        <li><strong>Bypass</strong> — auto-accept all tools</li>
        <li><strong>Plan</strong> — plan file only</li>
      </ul>
      <p>Natural-language <code>build …</code> / <code>make me a …</code> prompts auto-promote to code mode.</p>

      <h2 id="live">Live activity UI</h2>
      <p>While the model works you should see:</p>
      <ul>
        <li><code>+ Thought</code> — reasoning timing and preview</li>
        <li><code>~ Waiting for model</code> / <code>~ Generating response</code></li>
        <li><code>~ Write path</code> / <code>~ Read path</code> — tools in progress</li>
        <li><code>+ Write path</code> — file verified on disk</li>
      </ul>

      <h2 id="troubleshooting">Troubleshooting</h2>
      <ul>
        <li><code>/doctor</code> — install health check</li>
        <li><code>/provider list</code> — switch models if responses are slow</li>
        <li>First launch slow? <code>npm run warm</code> once from the Blink source tree</li>
        <li>Use an external terminal (Windows Terminal) for best Ink UI</li>
        <li>Write failed but UI showed success? Blink now verifies files on disk and dedupes duplicate Write lines</li>
      </ul>

      <footer>
        Generated by Blink v${version}. Regenerate with <code>/guide</code> in any project folder.
      </footer>
    </main>
  </div>
  <script>
    const links = document.querySelectorAll('nav a[href^="#"]');
    const search = document.getElementById('doc-search');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        links.forEach(a => {
          const text = (a.textContent + ' ' + (a.dataset.keywords || '')).toLowerCase();
          a.classList.toggle('hidden', q.length > 0 && !text.includes(q));
        });
      });
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('main h2[id], main h1[id]').forEach(h => obs.observe(h));
  </script>
</body>
</html>
`
}

export async function writeBlinkDocsSite(
  cwd: string,
): Promise<DocsSiteResult> {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const docsDir = join(cwd, 'docs')
  await mkdir(docsDir, { recursive: true })
  const indexPath = join(docsDir, 'index.html')
  await writeFile(indexPath, buildBlinkDocsSiteHtml(), 'utf8')
  return { indexPath, pages: [indexPath] }
}
