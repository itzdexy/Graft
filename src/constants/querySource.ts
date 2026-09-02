/**
 * Where a query originated from. Used for analytics, transcript persistence
 * decisions, and feature gating per call site.
 *
 * `repl_main_thread` transcripts are persisted for resume; `agent:*` sources
 * persist for subagent debugging; everything else is ephemeral.
 */
export type QuerySource =
  // Main interactive REPL thread (and variants)
  | 'repl_main_thread'
  | `repl_main_thread:${string}`
  // Subagents: `agent:<agentType>` or `agent:<agentType>:<agentId>`
  | `agent:${string}`
  | 'agent_sdk'
  | 'agent_summary'
  | 'auto_dream'
  | 'auto_mode'
  | 'auto_mode_critique'
  | 'away_summary'
  | 'bash_extract_prefix'
  | 'chrome_mcp'
  | 'compact'
  | 'extract_memories'
  | 'feedback'
  | 'generate_session_title'
  | 'hook_agent'
  | 'hook_prompt'
  | 'insights'
  | 'magic_docs'
  | 'mcp_datetime_parse'
  | 'memdir_relevance'
  | 'model_validation'
  | 'permission_explainer'
  | 'prompt_suggestion'
  | 'rename_generate_name'
  | 'sdk'
  | 'session_memory'
  | 'session_search'
  | 'side_question'
  | 'skill_improvement_apply'
  | 'speculation'
  | 'teleport_generate_title'
  | 'tool_use_summary_generation'
  | 'web_fetch_apply'
  | 'web_search_tool'
  // Allow arbitrary future sources without breaking call sites.
  | (string & {})
