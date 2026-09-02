// In its own file to avoid circular dependencies
export const FILE_EDIT_TOOL_NAME = 'Edit'

// Permission pattern for granting session-level access to the project's .tovyr/ folder
export const TOVYR_FOLDER_PERMISSION_PATTERN = '/.tovyr/**'

// Permission pattern for granting session-level access to the global ~/.tovyr/ folder
export const GLOBAL_TOVYR_FOLDER_PERMISSION_PATTERN = '~/.tovyr/**'

export const FILE_UNEXPECTEDLY_MODIFIED_ERROR =
  'File has been unexpectedly modified. Read it again before attempting to write it.'
