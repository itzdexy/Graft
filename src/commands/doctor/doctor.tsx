import React from 'react'
import { Doctor } from '../../screens/Doctor.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  formatProviderConnectionSnapshot,
  probeActiveProviderConnection,
} from '../../services/tovyr/providers/probe.js'

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  if (args.trim().toLowerCase() === 'provider') {
    const snapshot = await probeActiveProviderConnection({ force: true })
    onDone(formatProviderConnectionSnapshot(snapshot), { display: 'system' })
    return null
  }
  return Promise.resolve(<Doctor onDone={onDone} />)
}
