export type ParsedError = {
  file?: string
  line?: number
  column?: number
  code?: string
  message: string
  raw: string
}

const TS_ERROR = /^(.*)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/i
const ESLINT = /^(.+):(\d+):(\d+):\s*(error|warning)\s+(.+)$/i
const GENERIC_FILE_LINE = /^(.+?):(\d+)(?::(\d+))?\s*[-:]?\s*(error|Error|FAIL).*?[:]\s*(.+)$/i
const JEST_FAIL = /^\s*●\s+(.+)$/ 
const RUST_ERROR = /^error(?:\[(E\d+)\])?:\s*(.+)$/i

export function extractErrorsFromOutput(output: string, max = 30): ParsedError[] {
  const errors: ParsedError[] = []
  const seen = new Set<string>()

  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let parsed: ParsedError | null = null

    let m = TS_ERROR.exec(trimmed)
    if (m) {
      parsed = {
        file: m[1],
        line: Number(m[2]),
        column: Number(m[3]),
        code: m[4],
        message: m[5]!,
        raw: trimmed,
      }
    }

    if (!parsed) {
      m = ESLINT.exec(trimmed)
      if (m) {
        parsed = {
          file: m[1],
          line: Number(m[2]),
          column: Number(m[3]),
          message: m[5]!,
          raw: trimmed,
        }
      }
    }

    if (!parsed) {
      m = GENERIC_FILE_LINE.exec(trimmed)
      if (m) {
        parsed = {
          file: m[1],
          line: Number(m[2]),
          column: m[3] ? Number(m[3]) : undefined,
          message: m[5] ?? trimmed,
          raw: trimmed,
        }
      }
    }

    if (!parsed && JEST_FAIL.test(trimmed)) {
      parsed = { message: trimmed.replace(/^\s*●\s+/, ''), raw: trimmed }
    }

    if (!parsed) {
      m = RUST_ERROR.exec(trimmed)
      if (m) {
        parsed = {
          code: m[1],
          message: m[2]!,
          raw: trimmed,
        }
      }
    }

    if (!parsed && /^(Error|FAIL|AssertionError|TypeError):/i.test(trimmed)) {
      parsed = { message: trimmed, raw: trimmed }
    }

    if (parsed && !seen.has(parsed.raw)) {
      seen.add(parsed.raw)
      errors.push(parsed)
      if (errors.length >= max) break
    }
  }

  return errors
}

export function summarizeErrors(errors: ParsedError[]): string {
  if (!errors.length) return 'No structured errors parsed from output.'
  const lines = ['## Parsed errors', '']
  for (const e of errors.slice(0, 15)) {
    const loc = e.file
      ? `${e.file}${e.line ? `:${e.line}` : ''}`
      : ''
    const prefix = [e.code, loc].filter(Boolean).join(' ')
    lines.push(`- ${prefix ? `${prefix} — ` : ''}${e.message}`)
  }
  if (errors.length > 15) {
    lines.push(`- … and ${errors.length - 15} more`)
  }
  return lines.join('\n')
}

export function suggestFixStrategy(errors: ParsedError[]): string[] {
  const hints: string[] = []
  const text = errors.map(e => e.message + e.raw).join(' ').toLowerCase()

  if (text.includes('cannot find module') || text.includes('module not found')) {
    hints.push('Run package install (npm/bun/pnpm install) or fix import paths.')
  }
  if (text.includes('ts') || text.includes('type')) {
    hints.push('Fix TypeScript types at cited file:line before re-running typecheck.')
  }
  if (text.includes('eslint') || text.includes('lint')) {
    hints.push('Address lint violations; run lint --fix if the project supports it.')
  }
  if (text.includes('test') || text.includes('expect') || text.includes('assert')) {
    hints.push('Open failing test file, fix implementation or update test expectations.')
  }
  if (text.includes('syntaxerror')) {
    hints.push('Check for missing brackets, quotes, or invalid syntax at the reported line.')
  }
  if (!hints.length) {
    hints.push('Read files cited in errors; fix root cause; re-run verify.')
  }
  return hints
}
