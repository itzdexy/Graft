import type { ModelDescriptor } from '../../providers/types.js'

const TOVYR_BASE_INSTRUCTIONS = 'You are Tovyr, an AI coding agent. Work with the user to complete the requested task.'

const REASONING_LEVELS = [
  { effort: 'low', description: 'Fast responses with lighter reasoning' },
  { effort: 'medium', description: 'Balances speed and reasoning depth for everyday tasks' },
  { effort: 'high', description: 'Greater reasoning depth for complex problems' },
  { effort: 'xhigh', description: 'Extra high reasoning depth for complex problems' },
]

/**
 * Codex uses a richer private model-catalog schema than the public OpenAI
 * `/v1/models` response. Keep this conversion at the gateway boundary so the
 * same Tovyr model descriptors work for Codex and ordinary OpenAI clients.
 */
export function toCodexModelInfo(model: ModelDescriptor): Record<string, unknown> {
  const supportsReasoning = model.supportsReasoning !== false
  const contextWindow = model.contextTokens || 128_000
  return {
    slug: model.id,
    display_name: model.displayName,
    description: `Tovyr model (${model.id.split('::')[0]})`,
    default_reasoning_level: supportsReasoning ? 'medium' : 'none',
    supported_reasoning_levels: supportsReasoning ? REASONING_LEVELS : [],
    shell_type: 'unified_exec',
    visibility: 'list',
    supported_in_api: true,
    priority: 0,
    additional_speed_tiers: [],
    service_tiers: [],
    availability_nux: null,
    upgrade: null,
    model_messages: { instructions_template: TOVYR_BASE_INSTRUCTIONS },
    include_skills_usage_instructions: false,
    include_plugin_usage_instructions: true,
    include_apps_usage_instructions: true,
    default_reasoning_summary: 'none',
    support_verbosity: true,
    default_verbosity: 'low',
    apply_patch_tool_type: 'freeform',
    web_search_tool_type: 'text_and_image',
    auto_compact_token_limit: null,
    truncation_policy: { mode: 'tokens', limit: 10_000 },
    supports_image_detail_original: model.supportsVision === true,
    supports_parallel_tool_calls: true,
    supports_reasoning_summaries: true,
    context_window: contextWindow,
    max_context_window: contextWindow,
    effective_context_window_percent: 95,
    experimental_supported_tools: [],
    input_modalities: model.supportsVision === true ? ['text', 'image'] : ['text'],
    supports_search_tool: false,
    use_responses_lite: false,
    node_repl_auto_review_required: false,
    node_repl_disabled: false,
    tool_mode: 'code_mode_only',
    multi_agent_version: null,
    // Older Codex builds still deserialize this legacy field.
    base_instructions: TOVYR_BASE_INSTRUCTIONS,
  }
}

export function toCodexModelsResponse(models: ModelDescriptor[]): Record<string, unknown> {
  return {
    models: models.map(toCodexModelInfo),
    // Preserve the standard shape for OpenAI-compatible clients that consume
    // this endpoint without Codex's private model metadata.
    object: 'list',
    data: models.map(model => ({ id: model.id, object: 'model', owned_by: model.id.split('::')[0] })),
  }
}
