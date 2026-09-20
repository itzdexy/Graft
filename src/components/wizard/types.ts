import type { Dispatch, ReactNode, SetStateAction } from 'react'

/**
 * A wizard step component. Steps read/update wizard state via useWizard()
 * and receive no props when rendered by WizardProvider.
 */
export type WizardStepComponent<
  T extends Record<string, unknown> = Record<string, unknown>,
> = (props: { wizard?: WizardContextValue<T> }) => ReactNode

/**
 * Value provided by WizardContext to step components.
 */
export type WizardContextValue<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  currentStepIndex: number
  totalSteps: number
  wizardData: T
  setWizardData: Dispatch<SetStateAction<T>>
  updateWizardData: (updates: Partial<T>) => void
  goNext: () => void
  goBack: () => void
  goToStep: (index: number) => void
  cancel: () => void
  title?: string
  showStepCounter: boolean
}

/**
 * Props for WizardProvider.
 */
export type WizardProviderProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  steps: WizardStepComponent<T>[]
  initialData?: T
  onComplete: (data: T) => void | Promise<void>
  onCancel?: () => void
  children?: ReactNode
  title?: string
  showStepCounter?: boolean
}
