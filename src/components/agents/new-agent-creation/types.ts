import type { AgentMemoryScope } from '../../../tools/AgentTool/agentMemory.js'
import type { CustomAgentDefinition } from '../../../tools/AgentTool/loadAgentsDir.js'
import type { SettingSource } from '../../../utils/settings/constants.js'

/**
 * Agent produced by the AI generation step (structural match for
 * generateAgent()'s return value).
 */
type GeneratedAgent = {
  identifier: string
  whenToUse: string
  systemPrompt: string
}

/**
 * Accumulated state across the create-new-agent wizard steps.
 * All fields are optional because data fills in progressively
 * (initial wizard data is an empty object).
 */
export type AgentWizardData = {
  /** Where the agent file will be saved */
  location?: SettingSource

  /** Whether the agent is AI-generated or authored manually */
  method?: 'generate' | 'manual'
  wasGenerated?: boolean
  generationPrompt?: string
  isGenerating?: boolean
  generatedAgent?: GeneratedAgent

  /** Agent identity fields */
  agentType?: string
  whenToUse?: string
  systemPrompt?: string

  /** Tool allowlist; undefined means "all tools" */
  selectedTools?: string[]

  selectedModel?: string
  selectedColor?: string
  selectedMemory?: AgentMemoryScope

  /** Fully-formed agent prepared for confirmation and saving */
  finalAgent?: CustomAgentDefinition
}
