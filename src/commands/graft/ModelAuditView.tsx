import React, { useEffect, useRef, useState } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { auditProviderModels, formatModelAudit } from '../../services/graft/models/modelAudit.js'

export function ModelAuditView({ check, all, onDone }: { check: boolean; all: boolean; onDone: LocalJSXCommandOnDone }) {
  const [progress, setProgress] = useState('Preparing model catalog')
  const controller = useRef(new AbortController())
  useInput((_input, key) => { if (key.escape) controller.current.abort() })
  useEffect(() => {
    const runController = new AbortController()
    controller.current = runController
    let mounted = true
    void auditProviderModels({ check, all, signal: runController.signal, onProgress: text => { if (mounted) setProgress(text) } })
      .then(reports => { if (mounted) onDone(formatModelAudit(reports, check), { display: 'system' }) })
      .catch(() => { if (mounted) onDone('Model check stopped. Your active provider and model were preserved.', { display: 'system' }) })
    return () => { mounted = false; runController.abort() }
  }, [check, all, onDone])
  return <Box flexDirection="column"><Text>{progress}</Text><Text dimColor>{check ? 'Small inference checks may incur provider charges · ' : ''}Esc to cancel</Text></Box>
}
