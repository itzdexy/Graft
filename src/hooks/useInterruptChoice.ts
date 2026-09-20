/**
 * Handles [r] resume / [n] new after Esc interrupt.
 * Must be rendered inside KeybindingSetup.
 */
import { useCallback, useRef } from 'react'
import { useKeybinding } from '../keybindings/useKeybinding.js'

type Props = {
  /** True after Esc cancelled a running turn until r/n or a new submit. */
  pending: boolean
  inputEmpty: boolean
  isLoading: boolean
  /** Last user prompt text to re-submit on resume. */
  lastPrompt: string | null
  onResume: (prompt: string) => void
  onNew: () => void
}

export function InterruptChoiceHandler({
  pending,
  inputEmpty,
  isLoading,
  lastPrompt,
  onResume,
  onNew,
}: Props): null {
  const lastPromptRef = useRef(lastPrompt)
  lastPromptRef.current = lastPrompt

  const active = pending && inputEmpty && !isLoading

  const handleResume = useCallback(() => {
    const prompt = lastPromptRef.current?.trim()
    if (!prompt) {
      onNew()
      return
    }
    onResume(prompt)
  }, [onResume, onNew])

  const handleNew = useCallback(() => {
    onNew()
  }, [onNew])

  useKeybinding('chat:interruptResume', handleResume, { isActive: active })
  useKeybinding('chat:interruptNew', handleNew, { isActive: active })

  return null
}
