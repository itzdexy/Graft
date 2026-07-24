// Superthinker mode — a "do the best it can" workflow inspired by obra/superpowers:
// instead of jumping into code, the agent researches, teases out a spec via
// clarifying questions (delivered through a localhost page), gets the design
// signed off (plan preview), then builds and shows a result preview.

export type SuperthinkQuestionType = 'text' | 'choice' | 'multichoice' | 'boolean'

export type SuperthinkQuestion = {
  id: string
  prompt: string
  type: SuperthinkQuestionType
  /** Options for choice / multichoice questions. */
  options?: string[]
  placeholder?: string
  required?: boolean
  help?: string
}

export type SuperthinkAnswerValue = string | string[] | boolean

export type SuperthinkAnswer = {
  id: string
  value: SuperthinkAnswerValue
}

export type SuperthinkPlan = {
  /** Short research/understanding summary. */
  summary: string
  /** Decisions derived from the user's answers. */
  decisions: string[]
  /** Bite-sized, ordered implementation steps. */
  steps: string[]
}

export type SuperthinkPhase = 'clarify' | 'plan' | 'approved'

export type SuperthinkCommand =
  | 'run'
  | 'continue'
  | 'go'
  | 'on'
  | 'off'
  | 'status'
  | 'result'
  | 'help'

export type ParsedSuperthinkArgs = {
  command: SuperthinkCommand
  /** Goal text for `run`, or path for `result`. */
  goal: string
}

export type SuperthinkResolution = {
  answers: SuperthinkAnswer[]
  plan: SuperthinkPlan
  approved: boolean
}
