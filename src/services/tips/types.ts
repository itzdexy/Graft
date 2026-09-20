import type { FileStateCache } from '../../utils/fileStateCache.js'
import type { ThemeName } from '../../utils/theme.js'

/**
 * Context passed to tip content/relevance functions so tips can inspect
 * session state and style their text.
 */
export type TipContext = {
  theme: ThemeName
  /** LRU of files read this session (path → metadata) */
  readFileState?: FileStateCache
  /** Bash/CLI tools invoked recently this session */
  bashTools?: Set<string>
}

/**
 * A single spinner tip.
 */
export type Tip = {
  /** Stable identifier used for cooldown tracking */
  id: string
  /** Renders the tip body, optionally styled via context */
  content: (context: TipContext) => Promise<string>
  /** Minimum sessions between showings of this tip */
  cooldownSessions: number
  /** Whether this tip applies to the current session state */
  isRelevant: (context?: TipContext) => Promise<boolean>
}
