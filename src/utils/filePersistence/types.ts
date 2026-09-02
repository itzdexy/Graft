/** Milliseconds since epoch when the current turn started. */
export type TurnStartTime = number

export const OUTPUTS_SUBDIR = 'outputs'

/** Max modified files uploaded per turn (BYOC file persistence). */
export const FILE_COUNT_LIMIT = 100

/** Parallel upload cap for session file persistence. */
export const DEFAULT_UPLOAD_CONCURRENCY = 5

export type PersistedFile = {
  filename: string
  file_id: string
}

export type FailedPersistence = {
  filename: string
  error: string
}

export type FilesPersistedEventData = {
  files: PersistedFile[]
  failed: FailedPersistence[]
}
