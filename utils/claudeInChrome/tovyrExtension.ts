import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const CONFIG_DIR = join(homedir(), '.tovyr')
const IDS_PATH = join(CONFIG_DIR, 'chrome-extension-ids.json')

function readIdsFile(): string[] {
  if (!existsSync(IDS_PATH)) return []
  try {
    const parsed = JSON.parse(readFileSync(IDS_PATH, 'utf8')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

/** Extension IDs the user registered via `kairo chrome setup`. */
export function getTovyrChromeExtensionIds(): string[] {
  return readIdsFile()
}

export function saveTovyrChromeExtensionId(extensionId: string): void {
  const normalized = extensionId.trim()
  if (!/^[a-p]{32}$/i.test(normalized)) {
    throw new Error(
      `Invalid Chrome extension ID "${extensionId}". Expected 32 lowercase letters a-p.`,
    )
  }
  const ids = new Set(readIdsFile())
  ids.add(normalized.toLowerCase())
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(IDS_PATH, JSON.stringify([...ids], null, 2))
}

export function getTovyrChromeExtensionOrigins(): string[] {
  return getTovyrChromeExtensionIds().map(id => `chrome-extension://${id}/`)
}

export const TOVYR_CHROME_EXTENSION_REPO_PATH = 'chrome-extension'

export const TOVYR_CHROME_DOCS_URL =
  'https://github.com/Dexyy2/Tovyr-code-cli/tree/main/chrome-extension'
