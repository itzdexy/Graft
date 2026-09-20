import React from 'react'
import type { StatsStore } from './context/stats.js'
import type { Root } from './ink.js'
import type { Props as REPLProps } from './screens/REPL.js'
import type { AppState } from './state/AppStateStore.js'
import type { FpsMetrics } from './utils/fpsTracker.js'

type AppWrapperProps = {
  getFpsMetrics: () => FpsMetrics | undefined
  stats?: StatsStore
  initialState: AppState
}

type ReplModules = [
  typeof import('./components/App.js'),
  typeof import('./screens/REPL.js'),
]

let replModulesPromise: Promise<ReplModules> | undefined

function loadReplModules(): Promise<ReplModules> {
  return (replModulesPromise ??= Promise.all([
    import('./components/App.js'),
    import('./screens/REPL.js'),
  ]))
}

/** Start loading the chat UI while the remaining startup checks run. */
export function prepareReplModules(): void {
  void loadReplModules()
}

export async function launchRepl(
  root: Root,
  appProps: AppWrapperProps,
  replProps: REPLProps,
  renderAndRun: (root: Root, element: React.ReactNode) => Promise<void>,
): Promise<void> {
  const [{ App }, { REPL }] = await loadReplModules()
  await renderAndRun(
    root,
    <App {...appProps}>
      <REPL {...replProps} />
    </App>,
  )
}
