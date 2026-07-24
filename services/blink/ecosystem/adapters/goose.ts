import { formatGooseRecipeList } from '../recipes/gooseRecipes.js'

export function formatGooseHelp(): string {
  return [
    '# Goose patterns',
    '',
    'Goose is recipe-driven: multi-step workflows with MCP tool composition.',
    '',
    '## Recipes',
    formatGooseRecipeList(),
    '',
    '## Commands',
    '- `/recipe list` — all recipes',
    '- `/recipe start <id>` — begin workflow (auto-runs step 1)',
    '- `/recipe next` — advance after each step',
    '- `/recipe status` · `/recipe stop`',
    '',
    '## MCP extensions',
    'Prefer MCP tools over ad-hoc shell — `/mcp` to list servers.',
    '',
    '## Session rampage',
    '`/ecosystem rampage` loads all 14 upstream skills for this session.',
  ].join('\n')
}
