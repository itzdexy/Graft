import { useState } from 'react'

export type ModalState =
  | 'none'
  | 'commands'
  | 'models'
  | 'agents'
  | 'help'
  | 'file_reference'
  | 'slash_commands'
  | 'error_details'

export function useModalState(initial: ModalState = 'none') {
  const [modal, setModal] = useState<ModalState>(initial)

  return {
    modal,
    setModal,
    openCommands: () => setModal('commands'),
    openModels: () => setModal('models'),
    openAgents: () => setModal('agents'),
    openHelp: () => setModal('help'),
    openFileReference: () => setModal('file_reference'),
    openSlashCommands: () => setModal('slash_commands'),
    openErrorDetails: () => setModal('error_details'),
    close: () => setModal('none'),
    isOpen: modal !== 'none',
  }
}
