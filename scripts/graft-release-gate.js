import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RELEASE_GATES = [
  'core', 'security', 'licensing', 'architecture',
  'functionality', 'experience', 'compatibility', 'distribution',
]

export function releaseBlockers(report) {
  if (report?.version !== '1.4.0') return ['Missing v1.4.0 release evidence']
  return RELEASE_GATES.filter(name => {
    const gate = report.gates?.[name]
    return gate?.status !== 'passed' || typeof gate.evidence !== 'string'
      || !gate.evidence.trim()
  })
}

export function assertReleaseReady() {
  const report = JSON.parse(readFileSync(new URL('../release-status.json', import.meta.url), 'utf8'))
  const blockers = releaseBlockers(report)
  if (blockers.length) throw new Error(`Graft release blocked: ${blockers.join(', ')}. Record release evidence locally before publishing an npm package.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { assertReleaseReady() }
  catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
