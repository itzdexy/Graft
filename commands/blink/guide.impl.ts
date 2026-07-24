import type { LocalJSXCommandCall } from '../../types/command.js'
import { getCwd } from '../../utils/cwd.js'
import { writeBlinkDocsSite } from '../../services/blink/docs/buildDocsSite.js'
import { basename, relative } from 'node:path'

export const call: LocalJSXCommandCall = async onDone => {
  try {
    const cwd = getCwd()
    const result = await writeBlinkDocsSite(cwd)
    const label = relative(cwd, result.indexPath) || basename(result.indexPath)
    onDone(
      `Blink docs site written to **${label}** — open it in your browser (full sidebar docs with getting started, workflow, agents, and troubleshooting).`,
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    onDone(`Failed to write docs site: ${msg}`)
  }
}
