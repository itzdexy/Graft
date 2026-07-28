export type ProviderErrorKind =
  | 'missing_key'
  | 'invalid_key'
  | 'missing_base_url'
  | 'invalid_model'
  | 'model_unavailable'
  | 'rate_limit'
  | 'quota_exceeded'
  | 'timeout'
  | 'cancelled'
  | 'network_error'
  | 'auth_failed'
  | 'context_length'
  | 'bad_response'
  | 'unknown'

export type ClassifiedProviderError = {
  kind: ProviderErrorKind
  message: string
  status?: number
  retryable: boolean
  userMessage: string
}

export function isRateLimitErrorText(text: string): boolean {
  const t = text.toLowerCase()
  return (
    t.includes('rate limit') ||
    t.includes('rate_limit') ||
    t.includes('too many requests') ||
    t.includes('429') ||
    t.includes('requests per minute') ||
    t.includes('rpm limit')
  )
}

export function isQuotaErrorText(text: string): boolean {
  const t = text.toLowerCase()
  return (
    t.includes('quota') ||
    t.includes('billing') ||
    t.includes('insufficient credits') ||
    t.includes('exceeded your current') ||
    t.includes('payment required') ||
    t.includes('out of credits')
  )
}

export function isTimeoutErrorText(text: string, errorName?: string): boolean {
  const t = text.toLowerCase()
  return (
    errorName === 'TimeoutError' ||
    errorName === 'AbortError' ||
    t.includes('timeout') ||
    t.includes('timed out') ||
    t.includes('deadline exceeded')
  )
}

export function isNetworkErrorText(text: string, errorName?: string): boolean {
  const t = text.toLowerCase()
  return (
    errorName === 'TypeError' ||
    t.includes('fetch failed') ||
    t.includes('econnrefused') ||
    t.includes('enotfound') ||
    t.includes('network') ||
    t.includes('upstream unreachable') ||
    t.includes('socket hang up')
  )
}

export function isAuthErrorStatus(status?: number): boolean {
  return status === 401 || status === 403
}

export function isContextLengthErrorText(text: string): boolean {
  return /context (?:length|window)|maximum context|too many tokens|reduce the length|input tokens/i.test(
    text,
  )
}

function buildUserMessage(kind: ProviderErrorKind, detail: string): string {
  switch (kind) {
    case 'missing_key':
      return `No API key is configured. Run: tovyr auth login --key <your_key> or use /provider in chat.\n${detail}`
    case 'invalid_key':
      return `The API key for this provider looks invalid. Check the format and run: tovyr auth login --key <your_key>.\n${detail}`
    case 'missing_base_url':
      return `This provider needs a base URL. Run: tovyr provider use <id> then set the endpoint with /provider url <url>.\n${detail}`
    case 'invalid_model':
    case 'model_unavailable':
      return `${detail}\n\nRun /model or tovyr models to pick a supported model.`
    case 'rate_limit':
      return `Rate limit hit. Wait for the provider reset, switch models with /model, or switch providers with /provider.\n${detail}`
    case 'quota_exceeded':
      return `Provider quota or billing limit reached. Add credits or switch provider.\n${detail}`
    case 'timeout':
      return `Request timed out. Try a smaller prompt, /compact, or a faster model.\n${detail}`
    case 'cancelled':
      return `Request cancelled.`
    case 'network_error':
      return `Could not reach the provider. Check your network, VPN, firewall, and base URL.\n${detail}`
    case 'auth_failed':
      return `Authentication failed (HTTP 401/403). Verify your API key and provider.\n${detail}`
    case 'context_length':
      return `Context window exceeded. Use /compact, /clear, or a larger-context model.\n${detail}`
    case 'bad_response':
      return `Provider returned an invalid response. Retry or switch model.\n${detail}`
    default:
      return detail || 'An unexpected provider error occurred.'
  }
}

/** Classify HTTP status + message into a structured provider error. */
export function classifyProviderError(
  input: {
    status?: number
    message?: string
    errorName?: string
  } = {},
): ClassifiedProviderError {
  const message = (input.message || '').trim()
  const status = input.status

  if (status === 499 || (input.errorName === 'AbortError' && !message)) {
    return {
      kind: 'cancelled',
      message: message || 'cancelled',
      status,
      retryable: false,
      userMessage: buildUserMessage('cancelled', message),
    }
  }

  if (isAuthErrorStatus(status) || /\b(unauthorized|invalid api key|invalid authentication)\b/i.test(message)) {
    return {
      kind: 'auth_failed',
      message,
      status,
      retryable: false,
      userMessage: buildUserMessage('auth_failed', message),
    }
  }

  if (status === 429 || isRateLimitErrorText(message)) {
    return {
      kind: 'rate_limit',
      message,
      status,
      retryable: true,
      userMessage: buildUserMessage('rate_limit', message),
    }
  }

  if (isQuotaErrorText(message)) {
    return {
      kind: 'quota_exceeded',
      message,
      status,
      retryable: false,
      userMessage: buildUserMessage('quota_exceeded', message),
    }
  }

  if (status === 413 || isContextLengthErrorText(message)) {
    return {
      kind: 'context_length',
      message,
      status,
      retryable: false,
      userMessage: buildUserMessage('context_length', message),
    }
  }

  if (isTimeoutErrorText(message, input.errorName)) {
    return {
      kind: 'timeout',
      message,
      status,
      retryable: true,
      userMessage: buildUserMessage('timeout', message),
    }
  }

  if (isNetworkErrorText(message, input.errorName) || status === 502 || status === 503 || status === 504) {
    return {
      kind: 'network_error',
      message,
      status,
      retryable: true,
      userMessage: buildUserMessage('network_error', message),
    }
  }

  if (
    /\bmodel\b/i.test(message) &&
    (/\bnot available\b/i.test(message) ||
      /\bnot found\b/i.test(message) ||
      /\bunknown model\b/i.test(message) ||
      /\bnot supported\b/i.test(message))
  ) {
    return {
      kind: 'model_unavailable',
      message,
      status,
      retryable: false,
      userMessage: buildUserMessage('model_unavailable', message),
    }
  }

  if (status === 400 && /\bmodel\b/i.test(message)) {
    return {
      kind: 'invalid_model',
      message,
      status,
      retryable: false,
      userMessage: buildUserMessage('invalid_model', message),
    }
  }

  if (!message && status && status >= 500) {
    return {
      kind: 'bad_response',
      message: `HTTP ${status}`,
      status,
      retryable: true,
      userMessage: buildUserMessage('bad_response', `HTTP ${status}`),
    }
  }

  return {
    kind: 'unknown',
    message: message || (status ? `HTTP ${status}` : 'unknown error'),
    status,
    retryable: false,
    userMessage: message || 'An unexpected provider error occurred.',
  }
}

/** Failover is only safe for model availability issues — never on rate limits or auth errors. */
export function shouldAttemptProviderFailover(kind: ProviderErrorKind): boolean {
  return kind === 'model_unavailable' || kind === 'invalid_model'
}
