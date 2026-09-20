import { isGraftRuntime } from './graftRuntime.js'
import {
  GRAFT_SHORT_DESKTOP,
  GRAFT_SHORT_WEB,
} from '../constants/graft.js'

/** User-facing assistant name (Graft). */
export function getAssistantName(): string {
  return 'Graft'
}

/** User-facing product name. */
export function getProductName(): string {
  return 'Graft'
}

/** User-facing product name for Chrome extension / browser automation. */
export function getChromeProductName(): string {
  return 'Graft'
}

/** Short link for cloud/web sessions tip. */
export function getWebAppShortLink(): string {
  return isGraftRuntime() ? GRAFT_SHORT_WEB : 'clau.de/web'
}

/** Short link for desktop app tip. */
export function getDesktopAppShortLink(): string {
  return isGraftRuntime() ? GRAFT_SHORT_DESKTOP : 'clau.de/desktop'
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

/** Hooks / settings hint: "ask Graft" */
export function askAssistantPhrase(): string {
  return `ask ${getAssistantName()}`
}
