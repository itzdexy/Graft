import { formatAiderPartialApply } from './aiderRetry.js'

/** Minimal shape FileEditTool passes to mapToolResultToToolResultBlockParam. */
export type FileEditToolResultInput = {
  filePath?: string
  file_path?: string
  userModified?: boolean
  replaceAll?: boolean
  aider_warnings?: string[]
  aider_failures?: string[]
}

export type ToolResultBlockParam = {
  tool_use_id: string
  type: 'tool_result'
  content: string
  is_error?: boolean
}

export function resolveFileEditDisplayPath(data: FileEditToolResultInput): string {
  return data.filePath ?? data.file_path ?? 'the file'
}

export function mapAiderFileEditToolResult(
  data: FileEditToolResultInput,
  toolUseID: string,
): ToolResultBlockParam {
  const filePath = resolveFileEditDisplayPath(data)
  const modifiedNote = data.userModified
    ? '.  The user modified your proposed changes before accepting them. '
    : ''
  const warningNote =
    data.aider_warnings && data.aider_warnings.length > 0
      ? ` Warnings: ${data.aider_warnings.join(' ')}`
      : ''

  if (data.aider_failures && data.aider_failures.length > 0) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      is_error: true,
      content: formatAiderPartialApply(filePath, data.aider_failures),
    }
  }

  if (data.replaceAll) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: `The file ${filePath} has been updated${modifiedNote}. All occurrences were successfully replaced.${warningNote}`,
    }
  }

  return {
    tool_use_id: toolUseID,
    type: 'tool_result',
    content: `The file ${filePath} has been updated successfully${modifiedNote}.${warningNote}`,
  }
}