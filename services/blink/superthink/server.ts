import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import {
  normalizeSubmittedAnswers,
  synthesizePlan,
} from './core.js'
import { summarizeResearchBrief } from './researchStore.js'
import {
  renderPlanPage,
  renderQuestionsPage,
  renderResultPreviewIndex,
  renderThanksPage,
} from './html.js'
import type {
  SuperthinkAnswer,
  SuperthinkPlan,
  SuperthinkQuestion,
  SuperthinkResolution,
} from './types.js'

const LOOPBACK = '127.0.0.1'
const BODY_LIMIT = 1_000_000 // 1 MB — questionnaires are tiny; cap abuse.
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

export type QuestionnaireServer = {
  url: string
  port: number
  /** Resolves when the user approves the plan; rejects on timeout/close. */
  waitForResult: Promise<SuperthinkResolution>
  close: () => void
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let data = ''
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > BODY_LIMIT) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      data += chunk.toString('utf8')
    })
    req.on('end', () => resolveBody(data))
    req.on('error', reject)
  })
}

/** Parse an application/x-www-form-urlencoded body, collapsing repeats to arrays. */
export function parseFormBody(body: string): Record<string, string | string[]> {
  const params = new URLSearchParams(body)
  const out: Record<string, string | string[]> = {}
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key)
    out[key] = all.length > 1 ? all : (all[0] ?? '')
  }
  return out
}

function send(res: ServerResponse, status: number, body: string, contentType = 'text/html; charset=utf-8'): void {
  res.writeHead(status, { 'content-type': contentType })
  res.end(body)
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(303, { location })
  res.end()
}

/**
 * Start the clarify → plan-preview → approve flow on 127.0.0.1. Returns once the
 * server is listening (so the caller has the real port to open a browser to).
 */
export function startQuestionnaireServer(opts: {
  goal: string
  questions: SuperthinkQuestion[]
  researchBrief?: string | null
  port?: number
  timeoutMs?: number
}): Promise<QuestionnaireServer> {
  const { goal, questions } = opts
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const researchDisplay = opts.researchBrief
    ? summarizeResearchBrief(opts.researchBrief)
    : null

  let phase: 'clarify' | 'plan' = 'clarify'
  let answers: SuperthinkAnswer[] = []
  let plan: SuperthinkPlan = { summary: '', decisions: [], steps: [] }
  let settled = false

  let resolveResult!: (r: SuperthinkResolution) => void
  let rejectResult!: (e: Error) => void
  const waitForResult = new Promise<SuperthinkResolution>((res, rej) => {
    resolveResult = res
    rejectResult = rej
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  let server: Server

  const close = (): void => {
    if (timer) clearTimeout(timer)
    timer = undefined
    server?.close()
  }

  const settleReject = (err: Error): void => {
    if (settled) return
    settled = true
    rejectResult(err)
    close()
  }

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const url = req.url ?? '/'
      const method = req.method ?? 'GET'

      if (method === 'GET' && (url === '/' || url.startsWith('/?'))) {
        send(
          res,
          200,
          phase === 'clarify'
            ? renderQuestionsPage(goal, questions, [], researchDisplay)
            : renderPlanPage(goal, plan, researchDisplay),
        )
        return
      }

      if (method === 'POST' && url === '/submit') {
        const body = await readBody(req)
        const { answers: parsed, missingRequired } = normalizeSubmittedAnswers(
          questions,
          parseFormBody(body),
        )
        if (missingRequired.length) {
          send(res, 400, renderQuestionsPage(goal, questions, missingRequired, researchDisplay))
          return
        }
        answers = parsed
        plan = synthesizePlan(goal, questions, answers)
        phase = 'plan'
        redirect(res, '/')
        return
      }

      if (method === 'POST' && url === '/revise') {
        phase = 'clarify'
        redirect(res, '/')
        return
      }

      if (method === 'POST' && url === '/approve') {
        if (phase !== 'plan') {
          redirect(res, '/')
          return
        }
        send(res, 200, renderThanksPage())
        if (!settled) {
          settled = true
          resolveResult({ answers, plan, approved: true })
          // Let the response flush before tearing the socket down.
          setTimeout(close, 250)
        }
        return
      }

      send(res, 404, 'Not found', 'text/plain; charset=utf-8')
    } catch (err) {
      send(res, 400, `Bad request: ${(err as Error).message}`, 'text/plain; charset=utf-8')
    }
  }

  return new Promise<QuestionnaireServer>((resolveServer, rejectServer) => {
    server = createServer((req, res) => {
      void handler(req, res)
    })
    server.on('error', err => {
      // Surface a listen failure (e.g. port in use) to the caller.
      if (!settled) rejectServer(err)
    })
    server.listen(opts.port ?? 0, LOOPBACK, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      timer = setTimeout(
        () => settleReject(new Error('Superthink questionnaire timed out')),
        timeoutMs,
      )
      // Don't keep the process alive solely for this timer.
      timer.unref?.()
      resolveServer({
        url: `http://${LOOPBACK}:${port}/`,
        port,
        waitForResult,
        close,
      })
    })
  })
}

// ── Result preview (static file server) ─────────────────────────────────────

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
}

export type PreviewServer = { url: string; port: number; close: () => void }

/**
 * Serve `root` as a static result preview on 127.0.0.1, with path-traversal
 * protection. Serves index.html at `/` when present, else a generated listing.
 */
export function startResultPreviewServer(opts: {
  root: string
  title?: string
  port?: number
}): Promise<PreviewServer> {
  const root = resolve(opts.root)

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0]!)
    const requested = normalize(join(root, rawPath))
    // Path-traversal guard: never serve outside root.
    if (requested !== root && !requested.startsWith(root + sep)) {
      send(res, 403, 'Forbidden', 'text/plain; charset=utf-8')
      return
    }

    let target = requested
    if (existsSync(target) && statSync(target).isDirectory()) {
      const index = join(target, 'index.html')
      if (existsSync(index)) {
        target = index
      } else {
        send(
          res,
          200,
          renderResultPreviewIndex(opts.title ?? 'Build output', [
            { label: 'root directory has no index.html', href: '/' },
          ]),
        )
        return
      }
    }

    if (!existsSync(target)) {
      send(res, 404, 'Not found', 'text/plain; charset=utf-8')
      return
    }
    const type = CONTENT_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream'
    res.writeHead(200, { 'content-type': type })
    res.end(readFileSync(target))
  }

  return new Promise<PreviewServer>((resolveServer, rejectServer) => {
    const server = createServer(handler)
    server.on('error', rejectServer)
    server.listen(opts.port ?? 0, LOOPBACK, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolveServer({
        url: `http://${LOOPBACK}:${port}/`,
        port,
        close: () => server.close(),
      })
    })
  })
}
