import { auditProviderModels, formatModelAudit } from '../src/services/graft/models/modelAudit.js'

const args = process.argv.slice(2)
const check = args[0] === 'check'
if (!['refresh', 'check'].includes(args[0] ?? '')) throw new Error('Use graft models refresh|check [all|provider] [--limit N] [--timeout MS]')
const numberArg = (name: string) => {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = Number(args[index + 1])
  if (!Number.isFinite(value) || value < 1) throw new Error(`${name} requires a positive number`)
  return value
}
const controller = new AbortController()
process.once('SIGINT', () => controller.abort())
const target = args[1] && !args[1].startsWith('--') ? args[1] : undefined
const reports = await auditProviderModels({ check, all: target === 'all', providerId: target === 'all' ? undefined : target, limit: numberArg('--limit'), timeoutMs: numberArg('--timeout'), signal: controller.signal, onProgress: text => process.stderr.write(`${text}\n`) })
console.log(formatModelAudit(reports, check))
for (const report of reports) for (const result of report.checked) console.log(`${report.providerId} ${JSON.stringify(result.id)} ${result.status} ${result.latencyMs}ms`)
if (controller.signal.aborted) process.exitCode = 130
