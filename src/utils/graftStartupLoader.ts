export type GraftStartupPhase =
  | 'launch'
  | 'compile'
  | 'modules'
  | 'ui'
  | 'ready'

export {
  formatElapsedSeconds,
  formatProgressBar,
  formatStartupLoaderFrame,
  getGraftStartupElapsedMs,
  pickStartupTip,
  setGraftStartupPhase,
  shouldShowGraftStartupLoader,
  startGraftStartupLoader,
  stopGraftStartupLoader,
} from '../../scripts/graft-startup-loader.js'
