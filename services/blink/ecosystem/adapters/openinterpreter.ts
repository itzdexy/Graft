export type InterpreterLanguage = 'python' | 'javascript' | 'shell'

export const INTERPRETER_LANGUAGES: InterpreterLanguage[] = [
  'python',
  'javascript',
  'shell',
]

export function buildOpenInterpreterPrompt(
  lang: InterpreterLanguage,
  code: string,
): string {
  const runners: Record<InterpreterLanguage, string> = {
    python: 'python -c',
    javascript: 'node -e',
    shell: 'bash -c',
  }
  return [
    '# Open Interpreter mode',
    '',
    'Execute the snippet below via Bash, show stdout/stderr, then explain results.',
    'If execution fails, fix and retry once.',
    'Do not access network unless the user asked.',
    '',
    `Runner hint: \`${runners[lang]}\``,
    '',
    '```' + lang,
    code.trim(),
    '```',
  ].join('\n')
}

export function parseInterpretArgs(args: string): {
  lang: InterpreterLanguage
  code: string
} | null {
  const trimmed = args.trim()
  if (!trimmed) return null
  const [first, ...rest] = trimmed.split(/\s+/)
  const head = first!.toLowerCase()
  if (head === 'py' || head === 'python') {
    return { lang: 'python', code: rest.join(' ') }
  }
  if (head === 'js' || head === 'javascript' || head === 'node') {
    return { lang: 'javascript', code: rest.join(' ') }
  }
  if (head === 'sh' || head === 'bash' || head === 'shell') {
    return { lang: 'shell', code: rest.join(' ') }
  }
  return { lang: 'python', code: trimmed }
}

export function formatOpenInterpreterHelp(): string {
  return [
    '# Open Interpreter patterns',
    '',
    'Local code execution for open models — Python, JS, shell via Bash.',
    '',
    '## Commands',
    '- `/interpret python <code>` — run Python snippet',
    '- `/interpret js <code>` — run Node snippet',
    '- `/interpret shell <code>` — run shell snippet',
    '',
    '## Guardrails',
    'Show stdout/stderr, retry once on failure, no network unless asked.',
    'For GUI/computer-use tasks, describe steps and use Bash tools explicitly.',
  ].join('\n')
}
