import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  isBrowserUseConfigured,
  runBrowserUseTask,
} from '../../services/blink/browser/cloudClient.js'

export const BROWSER_USE_TOOL_NAME = 'BrowserUse'

const inputSchema = lazySchema(() =>
  z.strictObject({
    task: z
      .string()
      .min(1)
      .describe(
        'Natural-language web task (read live docs, test a UI, scrape data, reproduce a bug)',
      ),
  }),
)

const outputSchema = lazySchema(() =>
  z.object({
    output: z.string(),
    durationMs: z.number(),
  }),
)

export const BrowserUseTool = buildTool({
  name: BROWSER_USE_TOOL_NAME,
  searchHint: 'run a cloud browser task (Browser Use)',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  isEnabled() {
    return isBlinkRuntime() && isBrowserUseConfigured()
  },
  async description(input) {
    const task = (input as { task?: string }).task ?? ''
    const preview = task.length > 80 ? `${task.slice(0, 77)}…` : task
    return `Blink wants to run a cloud browser task: ${preview}`
  },
  userFacingName() {
    return 'Browser'
  },
  getToolUseSummary(input) {
    const task = (input as { task?: string }).task ?? ''
    return task.length > 60 ? `${task.slice(0, 57)}…` : task
  },
  getActivityDescription(input) {
    const task = (input as { task?: string }).task ?? ''
    const summary = task.length > 60 ? `${task.slice(0, 57)}…` : task
    return summary ? `Browser: ${summary}` : 'Cloud browser task'
  },
  get inputSchema() {
    return inputSchema()
  },
  get outputSchema() {
    return outputSchema()
  },
  isConcurrencySafe() {
    return false
  },
  isReadOnly() {
    return true
  },
  async prompt() {
    return `Run interactive web tasks in a cloud browser (Browser Use). Use for live docs, deployed UI checks, scraping, or reproducing web bugs when WebFetch is insufficient.

Requires BROWSER_USE_API_KEY in the environment. Prefer WebSearch/WebFetch for static pages; use this for tasks that need a real browser session.`
  },
  async checkPermissions() {
    return { behavior: 'allow', updatedInput: undefined }
  },
  async call(input, { abortController }) {
    const start = Date.now()
    const output = await runBrowserUseTask(
      input.task,
      abortController.signal,
    )
    return {
      data: { output, durationMs: Date.now() - start },
    }
  },
  renderToolUseMessage(input) {
    return `Browser task: ${input.task}`
  },
  renderToolResultMessage(result) {
    return result.output
  },
})
