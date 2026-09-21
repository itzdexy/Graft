/** Fetch complete model inventories without following provider-supplied URLs. */
export async function fetchPagedModelPayload(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const next = new URL(url)
  const seen = new Set<string>()
  const entries: unknown[] = []
  let shape = 'data'
  let totalBytes = 0
  for (let page = 0; page < 25; page++) {
    init.signal?.throwIfAborted()
    if (seen.has(next.href)) throw new Error('Model pagination repeated a cursor')
    seen.add(next.href)
    const response = await fetch(next, { ...init, redirect: 'error' })
    if (!response.ok) {
      await response.body?.cancel()
      throw Object.assign(new Error(`Model catalog returned HTTP ${response.status}`), { status: response.status })
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Model catalog returned no body')
    const decoder = new TextDecoder()
    let text = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > 10_000_000) throw new Error('Model catalog exceeded the size limit')
        text += decoder.decode(value, { stream: true })
      }
      text += decoder.decode()
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    const raw = JSON.parse(text)
    const payload = Array.isArray(raw) ? { data: raw } : raw
    if (!payload || typeof payload !== 'object') throw new Error('Invalid model catalog')
    shape = Array.isArray(payload.models) ? 'models' : 'data'
    if (!Array.isArray(payload[shape])) throw new Error('Invalid model catalog entries')
    entries.push(...payload[shape])
    if (entries.length > 20_000) throw new Error('Model catalog exceeded the model limit')
    if (typeof payload.nextPageToken === 'string' && payload.nextPageToken) {
      next.searchParams.set('pageToken', payload.nextPageToken)
    } else if (payload.has_more === true) {
      if (typeof payload.last_id !== 'string' || !payload.last_id) throw new Error('Model catalog omitted its next cursor')
      next.searchParams.set('after_id', payload.last_id)
    } else {
      return { [shape]: entries }
    }
  }
  throw new Error('Model catalog exceeded the page limit')
}
