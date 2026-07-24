export type BlinkStartupPhase =
  | 'launch'
  | 'compile'
  | 'modules'
  | 'ui'
  | 'ready'

export {
  formatElapsedSeconds,
  formatProgressBar,
  formatStartupLoaderFrame,
  getBlinkStartupElapsedMs,
  pickStartupTip,
  setBlinkStartupPhase,
  shouldShowBlinkStartupLoader,
  startBlinkStartupLoader,
  stopBlinkStartupLoader,
} from '../scripts/blink-startup-loader.js'
