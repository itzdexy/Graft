/**
 * CLI exit helpers for subcommand handlers.
 *
 * Consolidates the 4-5 line "print + lint-suppress + exit" block that was
 * copy-pasted ~60 times across `tovyr mcp *` / `tovyr plugin *` handlers.
 * The `: never` return type lets TypeScript narrow control flow at call sites
 * without a trailing `return`.
 */
/* eslint-disable custom-rules/no-process-exit -- centralized CLI exit point */

// `return undefined as never` (not a post-exit throw) — tests spy on
// process.exit and let it return. Call sites write `return cliError(...)`
// where subsequent code would dereference narrowed-away values under mock.
// cliError uses console.error (tests spy on console.error); cliOk uses
// process.stdout.write (tests spy on process.stdout.write — Bun's console.log
// doesn't route through a spied process.stdout.write).

/** Write an error message to stderr (if given) and exit with code 1. */
export function cliError(msg?: string): never {
  // biome-ignore lint/suspicious/noConsole: centralized CLI error output
  if (msg) console.error(msg)
  process.exit(1)
  return undefined as never
}

/** Exit with code 2 for usage errors. */
export function cliUsageError(msg?: string): never {
  if (msg) console.error(msg)
  process.exit(2)
  return undefined as never
}

/** Write JSON error envelope to stderr and exit 1. */
export function cliJsonError(error: string, data?: unknown): never {
  console.error(JSON.stringify({ ok: false, error, ...(data !== undefined ? { data } : {}) }))
  process.exit(1)
  return undefined as never
}

/** Write JSON success envelope to stdout and exit 0. */
export function cliJsonOk(data: unknown, message?: string): never {
  console.log(JSON.stringify({ ok: true, ...(message ? { message } : {}), data }))
  process.exit(0)
  return undefined as never
}

/** Write a message to stdout (if given) and exit with code 0. */
export function cliOk(msg?: string): never {
  if (msg) process.stdout.write(msg + '\n')
  process.exit(0)
  return undefined as never
}
