/**
 * Weak OpenAI-compatible models often emit Edit args with wrong field names
 * (`path`, `content`, `old_str`) or non-string values (objects/arrays).
 * Normalize before Zod validation so .replace() never sees invalid types.
 */

export function coerceEditString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    if (value.every(item => typeof item === 'string')) {
      return value.join('\n')
    }
    return value.map(item => coerceEditString(item)).join('\n')
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function firstString(
  raw: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) {
      return coerceEditString(raw[key])
    }
  }
  return undefined
}

/** Map alias fields onto canonical Edit tool shape. */
export function normalizeEditToolArguments(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw }

  const file_path =
    firstString(out, ['file_path', 'path', 'filePath', 'filename', 'file']) ??
    (typeof out.file_path === 'string' ? out.file_path : undefined)
  if (file_path !== undefined) out.file_path = file_path

  if (Array.isArray(out.edits) && out.edits.length > 0) {
    const first = out.edits[0]
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const edit = first as Record<string, unknown>
      if (out.old_string === undefined) {
        const old = firstString(edit, [
          'old_string',
          'old_str',
          'old_text',
          'search',
          'find',
          'oldString',
          'original',
          'from',
          'before',
        ])
        if (old !== undefined) out.old_string = old
      }
      if (out.new_string === undefined) {
        const neu = firstString(edit, [
          'new_string',
          'new_str',
          'new_text',
          'replace',
          'replacement',
          'replace_string',
          'newString',
          'content',
          'updated',
          'to',
          'after',
          'patch',
          'diff',
        ])
        if (neu !== undefined) out.new_string = neu
      }
    }
  }

  if (out.old_string === undefined) {
    const old = firstString(out, [
      'old_string',
      'old_str',
      'old_text',
      'search',
      'find',
      'oldString',
      'original',
      'from',
      'before',
    ])
    if (old !== undefined) out.old_string = old
  }

  if (out.new_string === undefined) {
    const neu = firstString(out, [
      'new_string',
      'new_str',
      'new_text',
      'replace',
      'replacement',
      'replace_string',
      'newString',
      'content',
      'text',
      'body',
      'updated',
      'to',
      'after',
      'patch',
      'diff',
    ])
    if (neu !== undefined) out.new_string = neu
  }

  if (out.old_string !== undefined) {
    out.old_string = coerceEditString(out.old_string)
  }
  if (out.new_string !== undefined) {
    out.new_string = coerceEditString(out.new_string)
  }
  if (
    out.new_string !== undefined &&
    out.old_string === undefined &&
    !Array.isArray(out.edits)
  ) {
    out.old_string = ''
  }

  return out
}

/** Zod preprocess: strip to strict Edit schema fields with normalized values. */
export function normalizeEditToolInputShape(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val
  const normalized = normalizeEditToolArguments(val as Record<string, unknown>)
  const shaped: Record<string, unknown> = {}
  if (normalized.file_path !== undefined) {
    shaped.file_path = coerceEditString(normalized.file_path)
  }
  shaped.old_string =
    normalized.old_string !== undefined
      ? coerceEditString(normalized.old_string)
      : ''
  if (normalized.new_string !== undefined) {
    shaped.new_string = coerceEditString(normalized.new_string)
  }
  if (normalized.replace_all !== undefined) {
    shaped.replace_all = normalized.replace_all
  }
  return shaped
}
