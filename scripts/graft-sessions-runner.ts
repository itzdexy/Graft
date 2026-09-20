/**
 * Bun runner for `graft sessions list` — lists resumable sessions for cwd.
 */
import { listSessionsImpl } from '../src/utils/listSessionsImpl.js'
import { EXIT, cliExit, isJsonMode } from './graft-cli-ux.js'

const limitArg = process.argv.find(a => a.startsWith('--limit='))
const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '10', 10) : 10
const cwd = process.env.GRAFT_INVOKE_CWD || process.cwd()

const sessions = await listSessionsImpl({
  dir: cwd,
  limit: Number.isFinite(limit) ? limit : 10,
})

if (isJsonMode()) {
  cliExit(EXIT.OK, {
    data: {
      cwd,
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        summary: s.summary,
        firstPrompt: s.firstPrompt,
        customTitle: s.customTitle,
        lastModified: s.lastModified,
        gitBranch: s.gitBranch,
      })),
    },
  })
}

if (sessions.length === 0) {
  console.log(`No saved sessions for ${cwd}`)
  console.log('Start one with: graft')
  process.exit(EXIT.OK)
}

console.log(`Sessions for ${cwd}\n`)
for (const s of sessions) {
  const title = s.customTitle || s.summary || s.firstPrompt || '(no summary)'
  const when = new Date(s.lastModified).toLocaleString()
  const branch = s.gitBranch ? ` · ${s.gitBranch}` : ''
  console.log(`  ${s.sessionId}`)
  console.log(`    ${title.slice(0, 120)}${title.length > 120 ? '…' : ''}`)
  console.log(`    ${when}${branch}`)
  console.log('')
}
console.log('Resume: graft --resume <session-id>')
