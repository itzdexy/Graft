import type { Command } from '../../commands.js'

const recipe: Command = {
  type: 'local-jsx',
  name: 'recipe',
  aliases: ['goose-recipe'],
  description: 'Goose-style multi-step workflows (ship-feature, fix-issue, …)',
  argumentHint: 'list | start <id> | next | status',
  load: () => import('./recipe.impl.js'),
}

export default recipe
