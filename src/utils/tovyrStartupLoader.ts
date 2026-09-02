export type TovyrStartupPhase =
  | 'launch'
  | 'compile'
  | 'modules'
  | 'ui'
  | 'ready'

export {
  formatElapsedSeconds,
  formatProgressBar,
  formatStartupLoaderFrame,
  getTovyrStartupElapsedMs,
  pickStartupTip,
  setTovyrStartupPhase,
  shouldShowTovyrStartupLoader,
  startTovyrStartupLoader,
  stopTovyrStartupLoader,
} from '../../scripts/tovyr-startup-loader.js'
