import type { Command } from '../../commands.js'

const aider: Command = {
  type: 'local',
  name: 'aider',
  description: 'Aider patterns — SEARCH/REPLACE, repo map, lint hints',
  argumentHint: 'format | map | lint',
  supportsNonInteractive: true,
  load: () => import('./aider.impl.js'),
}

export default aider
