/**
 * A selectable GitHub Actions workflow offered during setup.
 */
export type Workflow = 'claude' | 'claude-review'

/**
 * A non-fatal issue detected while checking the environment or repository.
 */
export type Warning = {
  title: string
  message: string
  instructions: string[]
}

/**
 * State machine for the install-github-app flow.
 */
export type State = {
  step:
    | 'check-gh'
    | 'warnings'
    | 'choose-repo'
    | 'install-app'
    | 'check-existing-workflow'
    | 'select-workflows'
    | 'check-existing-secret'
    | 'api-key'
    | 'oauth-flow'
    | 'creating'
    | 'success'
    | 'error'

  /** Repo input in "owner/repo" form (may be a full URL while typing) */
  selectedRepoName: string
  /** Repo detected from the current git remote, if any */
  currentRepo: string
  useCurrentRepo: boolean

  apiKeyOrOAuthToken: string
  useExistingKey: boolean

  currentWorkflowInstallStep: number
  warnings: Warning[]

  secretExists: boolean
  secretName: string
  useExistingSecret: boolean

  workflowExists: boolean
  selectedWorkflows: Workflow[]
  selectedApiKeyOption: 'existing' | 'new' | 'oauth'
  authType: 'api_key' | 'oauth_token'

  /** Chosen when an existing claude.yml workflow is found */
  workflowAction?: 'update' | 'skip' | 'exit'

  error?: string
  errorReason?: string
  errorInstructions?: string[]
}
