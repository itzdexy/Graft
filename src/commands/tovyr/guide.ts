import type { Command } from '../../commands.js'

const guide: Command = {
  type: 'local-jsx',
  name: 'guide',
  aliases: ['cheatsheet', 'commands', 'docs'],
  description: 'Write full Tovyr docs website to docs/index.html',
  immediate: true,
  load: () => import('./guide.impl.js'),
}

export default guide
