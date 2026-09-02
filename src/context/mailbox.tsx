import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { Mailbox } from '../utils/mailbox.js'
import {
  subscribeUdsMessages,
  type SessionEnvelope,
} from '../utils/udsMessaging.js'

const MailboxContext = createContext<Mailbox | undefined>(undefined)

type Props = {
  children: React.ReactNode
}

export function MailboxProvider({ children }: Props): React.ReactNode {
  const mailbox = useMemo(() => new Mailbox(), [])
  useEffect(
    () =>
      subscribeUdsMessages(message => {
        mailbox.send({
          id: message.id,
          source: 'teammate',
          from: message.from.address,
          content: formatCrossSessionMessage(message),
          timestamp: message.sentAt,
        })
      }),
    [mailbox],
  )
  return (
    <MailboxContext.Provider value={mailbox}>
      {children}
    </MailboxContext.Provider>
  )
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function formatCrossSessionMessage(message: SessionEnvelope): string {
  const from = escapeXml(message.from.address)
  const session = escapeXml(message.from.sessionId)
  const text = escapeXml(message.text)
  return `<cross-session-message from="${from}" session="${session}">\n${text}\n</cross-session-message>`
}

export function useMailbox(): Mailbox {
  const mailbox = useContext(MailboxContext)
  if (!mailbox) {
    throw new Error('useMailbox must be used within a MailboxProvider')
  }
  return mailbox
}
