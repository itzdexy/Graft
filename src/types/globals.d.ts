// Global build-time macros injected by src/build/preload.ts at runtime.
// Values are inlined/replaced by the bundler for external builds.

declare global {
  // eslint-disable-next-line no-var
  var MACRO: {
    VERSION: string
    BUILD_TIME: string
    PACKAGE_URL: string
    NATIVE_PACKAGE_URL: string
    ISSUES_EXPLAINER: string
    FEEDBACK_CHANNEL: string
    VERSION_CHANGELOG: string
  }
}

export {}
