import { getActiveProviderId, getProvider, listActivatedProviderIds, resolveProviderSelection } from '../../../../scripts/graft-providers.js'
import { fetchProviderModels, getProviderModelRefreshState } from '../providerModels.js'
import { probeProviderModel, type ModelAvailabilityResult } from '../providers/probe.js'
import { isAgentSuitableOpenAiModel } from '../openAiModelSuitability.js'
import type { ModelDescriptor } from '../providers/types.js'

export type ModelCheck = { id: string; status: string; latencyMs: number }
export type ProviderAudit = { providerId: string; catalog: string; listed: number; eligible: number; checked: ModelCheck[]; stopped?: string }
export type ModelAuditOptions = { all?: boolean; providerId?: string; check?: boolean; signal?: AbortSignal; limit?: number; timeoutMs?: number; onProgress?: (text: string) => void }

const defaultDependencies = {
  ids: () => listActivatedProviderIds().filter(id => !String(getProvider(id)?.category).startsWith('media_')),
  active: getActiveProviderId,
  selection: (id: string) => JSON.stringify(resolveProviderSelection(id)),
  fetch: fetchProviderModels,
  state: (id: string) => getProviderModelRefreshState(id)?.state ?? 'failed',
  probe: probeProviderModel,
}

/** Small fixed prompts only; never send project files, conversation text, or tools. */
export async function auditProviderModels(options: ModelAuditOptions = {}, deps = defaultDependencies): Promise<ProviderAudit[]> {
  const ids = options.all ? deps.ids() : [options.providerId ?? deps.active()]
  const reports: ProviderAudit[] = []
  const timeoutMs = Math.max(1000, Math.min(60_000, options.timeoutMs ?? 12_000))
  const limit = Math.max(0, Math.floor(options.limit ?? Number.MAX_SAFE_INTEGER))
  for (const providerId of [...new Set(ids)]) {
    if (options.signal?.aborted) break
    const original = deps.selection(providerId)
    const report: ProviderAudit = { providerId, catalog: 'failed', listed: 0, eligible: 0, checked: [] }
    reports.push(report)
    options.onProgress?.(`Refreshing ${providerId}`)
    let models: ModelDescriptor[] | null
    try { models = await deps.fetch(providerId, { force: true, signal: options.signal }) }
    catch { report.stopped = options.signal?.aborted ? 'cancelled' : 'catalog unavailable'; continue }
    report.catalog = deps.state(providerId)
    if (options.signal?.aborted) { report.stopped = 'cancelled'; break }
    report.listed = models?.length ?? 0
    if (deps.selection(providerId) !== original) { report.stopped = 'configuration changed'; continue }
    const eligible = (models ?? []).filter(m => m.available && m.lifecycle !== 'retired' && isAgentSuitableOpenAiModel(m.id))
    report.eligible = eligible.length
    if (!options.check || report.catalog !== 'live') continue
    const queue = eligible.slice(0, limit)
    let cursor = 0
    const worker = async () => {
      while (!report.stopped && !options.signal?.aborted) {
        const model = queue[cursor++]
        if (!model) break
        if (deps.selection(providerId) !== original) { report.stopped = 'configuration changed'; break }
        options.onProgress?.(`Checking ${providerId} · ${JSON.stringify(model.id)} · ${report.checked.length}/${queue.length}`)
        let result: ModelAvailabilityResult
        try { result = await deps.probe({ providerId, modelId: model.id, timeoutMs, signal: options.signal, forceInference: true }) }
        catch { report.stopped = options.signal?.aborted ? 'cancelled' : 'check interrupted'; break }
        if (deps.selection(providerId) !== original) { report.stopped = 'configuration changed'; break }
        report.checked.push({ id: model.id, status: result.ok ? 'passed' : result.errorKind ?? result.readiness, latencyMs: result.latencyMs })
        if (['invalid_key', 'auth_failed', 'quota_exceeded', 'rate_limit'].includes(result.errorKind ?? '')) report.stopped = result.errorKind
      }
    }
    // Keep probes modest; stop launching requests when the provider rate-limits.
    await Promise.all([worker(), worker()])
    if (options.signal?.aborted) report.stopped = 'cancelled'
    else if (!report.stopped && queue.length < eligible.length) report.stopped = 'requested limit'
  }
  return reports
}

export function formatModelAudit(reports: ProviderAudit[], checked: boolean): string {
  if (!reports.length) return 'No connected providers were checked.'
  return [
    ...reports.map(r => {
      const passed = r.checked.filter(c => c.status === 'passed').length
      const states = [...new Set(r.checked.map(c => c.status))].map(status => `${status}: ${r.checked.filter(c => c.status === status).length}`).join(', ')
      return `${r.providerId}: ${r.catalog} catalog · ${r.listed} listed · ${r.eligible} chat candidates${checked ? ` · ${r.checked.length} checked (${states || 'none'}), ${passed} passed` : ''}${r.stopped ? ` · stopped: ${r.stopped}` : ''}`
    }),
    '',
    checked ? 'Passed means a short text response succeeded. Tool calling, context capacity, and sustained streaming were not tested. Timeouts remain inconclusive; untested models are not failures.' : 'Catalog listings are not inference tests. Run /model check to test the active provider, or /model check all for connected providers. Checks may incur provider charges.',
  ].join('\n')
}
