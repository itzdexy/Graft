import { getChromeProductName } from '../tovyrBrand.js'

/** User-facing product name for browser automation. */
export function chromeProductName(): string {
  return getChromeProductName()
}

/** Short label for tool UI (e.g. Tovyr in Chrome[navigate]). */
export function chromeToolPrefix(): string {
  return chromeProductName()
}

/** Debug log prefix. */
export function chromeLogPrefix(): string {
  return `[${chromeProductName()}]`
}
