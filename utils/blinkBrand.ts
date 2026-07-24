import { isBlinkRuntime } from './blinkRuntime.js'
import {
  BLINK_SHORT_DESKTOP,
  BLINK_SHORT_WEB,
} from '../constants/blink.js'

/** User-facing assistant name (Blink in Blink). */
export function getAssistantName(): string {
  return isBlinkRuntime() ? 'Blink' : 'Blink'
}

/** User-facing product name. */
export function getProductName(): string {
  return isBlinkRuntime() ? 'Blink' : 'Blink'
}

/** Short link for cloud/web sessions tip. */
export function getWebAppShortLink(): string {
  return isBlinkRuntime() ? BLINK_SHORT_WEB : 'clau.de/web'
}

/** Short link for desktop app tip. */
export function getDesktopAppShortLink(): string {
  return isBlinkRuntime() ? BLINK_SHORT_DESKTOP : 'clau.de/desktop'
}

/** Permission prompt: accept with follow-up feedback. */
export function tellAssistantNextPlaceholder(): string {
  return `and tell ${getAssistantName()} what to do next`
}

/** Permission prompt: reject with feedback. */
export function tellAssistantDifferentlyPlaceholder(): string {
  return `and tell ${getAssistantName()} what to do differently`
}

/** Short help blurb for the interactive agent. */
export function getAgentHelpBlurb(): string {
  const name = getAssistantName()
  return `${name} understands your codebase, makes edits with your permission, and executes commands — right from your terminal.`
}

/** Hooks / settings hint: "ask Blink" */
export function askAssistantPhrase(): string {
  return `ask ${getAssistantName()}`
}
